<?php
/**
 * JSON-RPC server response class
 */

const JSON_RPC_VERSION = "2.0";

class Response {
    public $responses;
    
    public function __construct() {
        $this->responses = array();
        header('Content-type: application/json');
    }

    public function setPart($response, $id) {
        if (trim($id) === '') {
            $id = null;
        }
        
        list($key, $val) = each($response);
        $this->responses[] = array('jsonrpc' => JSON_RPC_VERSION,
                                   $key => $val,
                                   'id' => $id);
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
