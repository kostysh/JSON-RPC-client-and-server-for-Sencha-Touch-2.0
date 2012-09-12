<?php
/**
 * @filename Response.php
 *
 * @name Response class
 * @fileOverview JSON-RPC server response class definition
 *
 * @author Constantine V. Smirnov kostysh(at)gmail.com
 * @date 20120730
 * @version 2.0
 * @license GNU GPL v3.0
 *
 * @requires PHP 5.3
 */

const JSON_RPC_VERSION = "2.0";

class Response {
    protected $server;
    protected $responses;
    protected $extensions;
    
    public function __construct(&$server) {
        $this->server = $server;
        $this->responses = array();
        $this->extensions = null;
        
        // Prevent browser and proxy caching
        header("Pragma: no-cache");
        header("Cache-Control: no-cache, must-revalidate, post-check=0, pre-check=0"); // HTTP/1.1
        header("Expires: Sat, 26 Jul 1997 05:00:00 GMT"); // Date in the past
    }
    
    public function addExtension($extension) {
        if (!is_array($this->extensions)) {
            $this->extensions = array();
        }
        
        array_push($this->extensions, $extension);
    }

    public function setPart($response, $id) {
        if (trim($id) === '') {
            $id = null;
        }
        
        $out = array();
        
        if ($this->server->mode === 'json') {
            $out = $out + array('jsonrpc' => JSON_RPC_VERSION);
        }
        
        $out = $out + $response;
        
        if ($this->extensions !== null) {
            foreach ($this->extensions as $extension) {
                $out = $out + $extension;
            }
        }
        
        $out = $out + array('id' => $id);
        array_push($this->responses, $out);
    }
    
    protected function isVector(&$array) {
        $next = 0;
        foreach ($array as $k => $v) {
            if ($k !== $next)
                return false;
            $next++;
        }
        return true;
    }
    
    protected function convertResource(&$resource) {
        $resourceType = get_resource_type($resource);
        switch ($resourceType) {
            #case 'dbm':
            #case 'dba':
            #case 'dbase':
            #case 'domxml attribute':
            #case 'domxml document':
            #case 'domxml node':
            case 'fbsql result':
                $rows = array();
                $indexType = ($this->dbResultIndexType == 'ASSOC' ? FBSQL_ASSOC : FBSQL_NUM);
                while ($row = fbsql_fetch_array($resource, $indexType))
                    array_push($rows, $row);
                return $rows;

            #case 'gd': #return base64

            case 'msql query':
                $rows = array();
                $indexType = ($this->dbResultIndexType == 'ASSOC' ? MSQL_ASSOC : MSQL_NUM);
                while ($row = msql_fetch_array($resource, $indexType))
                    array_push($rows, $row);
                return $rows;

            case 'mssql result':
                $rows = array();
                $indexType = ($this->dbResultIndexType == 'ASSOC' ? MSSQL_ASSOC : MSSQL_NUM);
                while ($row = mssql_fetch_array($resource, $indexType))
                    array_push($rows, $row);
                return $rows;

            case 'mysql result':
                $rows = array();
                $indexType = ($this->dbResultIndexType == 'ASSOC' ? MYSQL_ASSOC : MYSQL_NUM);
                while ($row = mysql_fetch_array($resource, $indexType))
                    array_push($rows, $row);
                return $rows;

            case 'odbc result':
                $rows = array();
                if ($this->dbResultIndexType == 'ASSOC') {
                    while ($row = odbc_fetch_array($resource))
                        array_push($rows, $row);
                } else {
                    while ($row = odbc_fetch_row($resource))
                        array_push($rows, $row);
                }
                return $rows;

            #case 'pdf document':

            case 'pgsql result':
                $rows = array();
                $indexType = ($this->dbResultIndexType == 'ASSOC' ? PGSQL_ASSOC : PGSQL_NUM);
                while ($row = pg_fetch_array($resource, $indexType))
                    array_push($rows, $row);
                return $rows;

            case 'stream':
                return stream_get_contents($resource);

            case 'sybase-db result':
            case 'sybase-ct result':
                $rows = array();
                if ($this->dbResultIndexType == 'ASSOC') {
                    while ($row = sybase_fetch_assoc($resource))
                        array_push($rows, $row);
                } else {
                    while ($row = sybase_fetch_row($resource))
                        array_push($rows, $row);
                }
                return $rows;

            #case 'xml':

            default:
                return "Unable to return resource type '$resourceType'.";
        }
    }
    
    protected function encodeXmlRpc($value) {
        $xml = '<value>';
        
        if (is_bool($value)) {
            $xml .= '<boolean>' . ($value ? 1 : 0) . '</boolean>';
        } else if (is_int($value)) {
            $xml .= '<i4>' . $value . '</i4>';
        } else if (is_double($value)) {
            $xml .= '<double>' . $value . '</double>';
        } else if (is_string($value)) {
            $value = (htmlspecialchars($value, ENT_NOQUOTES));
            $value = preg_replace_callback('/([\x00-\x1F])/', create_function('$matches', 'return sprintf("&#x%02x;", ord($matches[0]));'), $value);
            $xml .= '<string>' . /* utf8_encode */($value) . '</string>';
        } else if ($value === null) {
            $xml .= '<nil/>';
        } else if (is_array($value)) {
            
            #XML-RPC <array>
            if ($this->isVector($value)) {
                $xml .= '<array><data>';
                for ($i = 0; $i < count($value); $i++) {
                    $xml .= $this->encodeXmlRpc($value[$i]);
                }
                $xml .= '</data></array>';
            }
            #XML-RPC <struct>
            else {
                $xml .= '<struct>';
                foreach ($value as $k => $v) {
                    $xml .= '<member>';
                    $name = htmlspecialchars($k, ENT_NOQUOTES);
                    $name = preg_replace_callback('/([\x00-\x1F])/', create_function('$matches', 'return sprintf("&#x%02x;", ord($matches[0]));'), $name);
                    $xml .= '<name>' . /* utf8_encode */($name) . '</name>';
                    $xml .= $this->encodeXmlRpc($v);
                    $xml .= '</member>';
                }
                $xml .= '</struct>';
            }
        } else if (is_object($value)) {
            $className = get_class($value);
            switch ($className) {
                case 'DateTime':
                    $xml .= "<dateTime.iso8601>";
                    $xml .= $value->format('Y-m-d\TH:i:s.u');
                    $xml .= "</dateTime.iso8601>";
                    break;
                default:
                    $xml .= '<struct><member><name>' . htmlspecialchars($className) . '</name><value>';
                    $members = get_object_vars($value);
                    if (count($members)) {
                        $xml .= '<struct>';
                        $count = 0;
                        foreach ($members as $k => $v) {
                            $xml .= '<member>';
                            $xml .= '<name>' . /* utf8_encode */(htmlspecialchars($k, ENT_NOQUOTES)) . '</name>';
                            $xml .= '<value>' . htmlspecialchars($v, ENT_NOQUOTES) . '</value>';
                            $xml .= '</member>';
                        }
                        $xml .= '</struct>';
                    }
                    $xml .= '</value></member></struct>';
            }
        } else if (is_resource($value)) {
            return $this->encodeXmlRpc($this->convertResource($value));
        } else {
            trigger_error("Unknown PHP data type: " . gettype($value));
        }
            
        $xml .= '</value>';
        return $xml;
    }
    
    public function send() {
        if ($this->server->mode === 'json') {
            header('Content-type: application/json; charset=utf-8');
            $prefix = '';
            $separator = ',';
            $batchPrefix = '[';
            $batchPostfix = ']';
        } else {
            header('Content-type: text/xml; charset=utf-8');
            $prefix = '<?xml version="1.0"?>';
            $separator = '';
            $batchPrefix = '<batch>';
            $batchPostfix = '</batch>';
        }        
        
        $arrayResponse = array();
        foreach ($this->responses as $response) {
            if ($this->server->mode === 'json') {
                array_push($arrayResponse, json_encode($response));
            } else {
                if (isset($response['error']) && is_object($response['error'])) {
                    $errResponse = '';
                    $errResponse .= '<fault><value><struct>';
                    $errResponse .= '<member>';
                    $errResponse .= '<name>faultCode</name>';
                    $errResponse .= '<value><int>' . htmlspecialchars($response['error']->code, ENT_NOQUOTES) . '</int></value>';
                    $errResponse .= '</member>';
                    $errResponse .= '<member>';
                    $errResponse .= '<name>faultString</name>';
                    $errResponse .= '<value>' . htmlspecialchars($response['error']->message, ENT_NOQUOTES) . '</value>';
                    $errResponse .= '</member>';
                    $errResponse .= '</struct></value></fault>';
                    array_push($arrayResponse, '<methodResponse>' . 
                                               $errResponse . 
                                               '</methodResponse>') ;
                } else {
                    array_push($arrayResponse, '<methodResponse><params><param>' . 
                                               $this->encodeXmlRpc($response). 
                                               '</param></params></methodResponse>') ;
                }
            }
        }
        
        $output = implode($separator, $arrayResponse);
        
        if (count($this->responses) > 1) {
            
            // Batch response
            echo $prefix . $batchPrefix . $output . $batchPostfix;
        } else {
            
            // Single response
            echo $prefix . $output;
        }
        
        exit;
    }
};
?>
