<?php
require_once('lib/JsonRpcServer.php');

// Custom server API class
class Api {
    
    // Place here your constructor, connect here to DB or read files etc...
    public function __construct() {
        
    }
    
    // Server API method
    public function getFields() {
        $params = array();
        $params['field1'] = 'mimi';
        $params['field2'] = 'pipi';
        $params['field3'] = 'popo';
        return $params;
    }
    
    public function saveFields($params) {
        return 'Hey dude!: ' . implode(',', $params);
    }
};

// Setup JSON-RPC server
$server = new jsonRPC(new Api());

// Start requests handling
$server->start();
?>
