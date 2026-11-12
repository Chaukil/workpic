param([int]$Port = 8080)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$allowedOrigins = @('https://chaukil.github.io')
function Hide-DbSecrets([string]$Text) {
    if ($env:WORKHOURS_DB_PASSWORD) { $Text = $Text.Replace($env:WORKHOURS_DB_PASSWORD, '[REDACTED]') }
    return [regex]::Replace($Text, '(?i)(Password|PWD)\s*=\s*("[^"]*"|''[^'']*''|[^;\r\n]*)', '$1=[REDACTED]')
}
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$listener = New-Object Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Open http://localhost:$Port (Ctrl+C to stop)"
try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $response = $context.Response
        $connection = $null
        $recordset = $null
        $stage = 'HTTP request'
        try {
            $path = $context.Request.Url.AbsolutePath
            # Allow local development previews to call the separate IBM service.
            $origin = $context.Request.Headers['Origin']
            if ($origin) {
                if ($origin -notin $allowedOrigins -and $origin -notmatch '^https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$') {
                    $response.StatusCode = 403
                    throw 'Origin not allowed'
                }
                $response.Headers['Access-Control-Allow-Origin'] = $origin
                $response.Headers['Vary'] = 'Origin'
                $response.Headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
                $response.Headers['Access-Control-Allow-Headers'] = 'Content-Type'
                if ($context.Request.Headers['Access-Control-Request-Private-Network'] -eq 'true') {
                    $response.Headers['Access-Control-Allow-Private-Network'] = 'true'
                }
            }
            if ($context.Request.HttpMethod -eq 'OPTIONS') {
                $response.StatusCode = 204
                $response.Close()
                continue
            }
            if ($context.Request.HttpMethod -ne 'GET') { $response.StatusCode = 405; throw 'GET only' }
            if ($path -eq '/api/health') {
                $response.ContentType = 'application/json; charset=utf-8'
                $bytes = [Text.Encoding]::UTF8.GetBytes('{"status":"ok","service":"workpic-api","version":1}')
            } elseif ($path -eq '/api/work-hours') {
                $stage = 'Check database credentials'
                if (!$env:WORKHOURS_DB_USER -or !$env:WORKHOURS_DB_PASSWORD) { throw 'Set WORKHOURS_DB_USER and WORKHOURS_DB_PASSWORD first.' }
                $stage = 'Create ADODB connection'
                $connection = New-Object -ComObject ADODB.Connection
                $connection.CursorLocation = 3
                $connection.ConnectionTimeout = 15
                $connection.CommandTimeout = 40
                $stage = 'Build IBM connection string'
                $builder = New-Object System.Data.OleDb.OleDbConnectionStringBuilder
                $builder['Provider'] = 'IBMDASQL.DataSource.1'
                $builder['Catalog Library List'] = 'JDETSTDTA'
                $builder['Persist Security Info'] = $false
                $builder['Force Translate'] = 0
                $builder['Data Source'] = 'WFVNPROD'
                $builder['User ID'] = $env:WORKHOURS_DB_USER
                $builder['Password'] = $env:WORKHOURS_DB_PASSWORD
                $stage = 'Connect to WFVNPROD'
                $connection.Open($builder.ConnectionString)
                # VBA CLng(Date): OLE Automation date serial, not YYYYMMDD.
                $today = [long][DateTime]::Today.ToOADate()
                $sql = "SELECT SITE, ETD, MSS, KIND, LINE, THU, FRI, SAT, SUN, MON, TUE, WED, PERCENTAGE_DAILY_AL_PROJECTTED, PHYSICAL_LINE FROM ADOWNLOADW.UPH_MSS_SETUP WHERE TARGET > 0 AND LINE IN ('M151','O100','O200') AND ETD >= $today ORDER BY ETD, MSS, KIND, LINE"
                $stage = 'Execute UPH_MSS_SETUP query'
                $recordset = $connection.Execute($sql)
                $stage = 'Read query results'
                $rows = [Collections.Generic.List[object]]::new()
                while (!$recordset.EOF) {
                    $row = [ordered]@{}
                    for ($i = 0; $i -lt $recordset.Fields.Count; $i++) {
                        $field = $recordset.Fields.Item($i)
                        $value = $field.Value
                        if ($value -is [DBNull]) { $value = $null }
                        if ($value -is [DateTime]) { $value = $value.ToString('yyyy-MM-dd') }
                        $row[$field.Name.Trim()] = $value
                    }
                    $rows.Add($row)
                    $recordset.MoveNext()
                }
                $response.ContentType = 'application/json; charset=utf-8'
                $response.Headers['Cache-Control'] = 'no-store'
                $bytes = [Text.Encoding]::UTF8.GetBytes((@{ rows = @($rows.ToArray()) } | ConvertTo-Json -Depth 8 -Compress))
            } else {
                # Serve only the public application files; never expose scripts or credentials.
                $files = @{ '/'='index.html'; '/index.html'='index.html'; '/app.js'='app.js'; '/styles.css'='styles.css'; '/sw.js'='sw.js'; '/work-hours-data.js'='work-hours-data.js'; '/api-client.js'='api-client.js' }
                $files['/app.min.js'] = 'app.min.js'
                if (!$files.ContainsKey($path)) { $response.StatusCode = 404; throw 'Not found' }
                $file = Join-Path $root $files[$path]
                $types = @{ '.html'='text/html'; '.js'='application/javascript'; '.css'='text/css'; '.json'='application/json' }
                $response.ContentType = $types[[IO.Path]::GetExtension($file)] + '; charset=utf-8'
                $bytes = [IO.File]::ReadAllBytes($file)
            }
        } catch {
            if ($response.StatusCode -eq 200) { $response.StatusCode = 503 }
            $failure = $_
            $details = [Collections.Generic.List[string]]::new()
            $details.Add((Hide-DbSecrets $failure.Exception.Message))
            $inner = $failure.Exception.InnerException
            while ($null -ne $inner) {
                $details.Add((Hide-DbSecrets $inner.Message))
                $inner = $inner.InnerException
            }
            if ($null -ne $connection) {
                try {
                    foreach ($adoError in $connection.Errors) {
                        $details.Add((Hide-DbSecrets ('ADO {0}; SQLState {1}; NativeError {2}: {3}' -f $adoError.Number, $adoError.SQLState, $adoError.NativeError, $adoError.Description)))
                    }
                } catch { } # Some errors happen before the ADO collection is available.
            }
            $hint = switch ($stage) {
                'Check database credentials' { 'Enter the IBM username and password in the Python launcher, then restart.' }
                'Create ADODB connection' { 'Check that Windows ADODB is installed and available.' }
                'Build IBM connection string' { 'Check IBM OLE DB provider installation and connection properties.' }
                'Connect to WFVNPROD' { 'Check IBM provider (32/64-bit), credentials, and network/VPN access to WFVNPROD.' }
                'Execute UPH_MSS_SETUP query' { 'Check table/column names, SELECT permissions, and the ETD data type in the IBM error below.' }
                default { 'Use the detailed error below to check the failing step.' }
            }
            $errorBody = @{
                error = 'IBM work-hours request failed'
                stage = $stage
                code = $failure.Exception.HResult
                details = @($details | Select-Object -Unique)
                hint = $hint
            }
            Write-Host ('[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), ($errorBody | ConvertTo-Json -Depth 5 -Compress))
            $response.ContentType = 'application/json; charset=utf-8'
            $response.Headers['Cache-Control'] = 'no-store'
            $bytes = [Text.Encoding]::UTF8.GetBytes(($errorBody | ConvertTo-Json -Depth 5 -Compress))
        } finally {
            if ($null -ne $recordset) { if ($recordset.State -eq 1) { $recordset.Close() }; [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($recordset) }
            if ($null -ne $connection) { if ($connection.State -eq 1) { $connection.Close() }; [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($connection) }
        }
        try { $response.ContentLength64 = $bytes.Length; $response.OutputStream.Write($bytes, 0, $bytes.Length) } finally { $response.Close() }
    }
} finally { $listener.Stop(); $listener.Close() }
