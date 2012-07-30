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
    protected $responses;
    protected $extensions;
    
    public function __construct() {
        $this->responses = array();
        $this->extensions = null;
        
        // Prevent browser and proxy caching
        header("Pragma: no-cache");
        header("Cache-Control: no-cache, must-revalidate, post-check=0, pre-check=0"); // HTTP/1.1
        header("Expires: Sat, 26 Jul 1997 05:00:00 GMT"); // Date in the past
        header('Content-type: application/json; charset=utf-8');
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
        $out = $out + array('jsonrpc' => JSON_RPC_VERSION);
        $out = $out + $response;
        
        if ($this->extensions !== null) {
            foreach ($this->extensions as $extension) {
                $out = $out + $extension;
            }
        }
        
        $out = $out + array('id' => $id);
        
        array_push($this->responses, $out);
    }
    
    public function send() {
        $jsonResponse = array();
        foreach ($this->responses as $response) {
            $jsonResponse[] = json_encode($response);
        }
        
        $output = implode(',', $jsonResponse);
        
        if (count($this->responses) > 1) {
            
            // Batch response
            echo '[' . $output . ']';
        } else {
            
            // Single response
            echo $output;
        }
        
        exit;
    }
};
?>
