JSON-RPC-client-and-server-for-Sencha-Touch-2.0
===============================================

This components you can use for build communication between Sencha Touch 2.0 
application and server via JSON-RPC protocol (spec. 2.0).  

Author: Constantine V. Smirnov, kostysh(at)gmail.com, http://mindsaur.com    
License: GNU GPL v3.0    
Current version: 1.0    
ST2 version: 2.1.0 Beta1    
ST2 SDK Tools: 2.0.0 Beta 3  

Requires:
=========
- Sencha Touch 2.0
- PHP 5.3 (for server)

Versions:
=========
- 2.0 New namespace, refactored code, bug fixes, GPL license, demo app
- 1.0 Initial release  

Features:
=========
- Conforms to JSON-RPC 2.0 Specification
- Single and batch requests
- By-position and by-name parameters structure
- Simple setup and usage  

Client usage:
=============

- Place src/ux to your app folder;
- Place src/php to your server;
- Configure custom path for custom components: 
<!-- language: lang-js -->
            
    // Initialisation of jsonRPC client
    var jsonRPC = Ext.create('Ext.ux.data.Jsonrpc', {
        url: 'http://path-to-your-server/rpc',
        timeout: 20000,
        scope: this,
        api: {
            getFields: function(result) {
                console.log(result);
            },
            saveFields: function(result) {
                console.log(result);
            },
            error: function(result) {
                console.log(result['message']);
            }
        }
    });
    
    // Single request to 'getFields' remote method
    jsonRPC.request({
        method: 'getFields'
    });
    
    // Single request to 'saveFields' remote method
    jsonRPC.request({
        method: 'saveFields',
        params: {
            field1: 'value1',
            field2: 'value2
        }
    });
    
    // Batch request
    jsonRPC.request(
        {
            method: 'getFields',
            batchOrder: 1
        },
        {
            method: 'saveFields',
            params: {
                field1: 'value1',
                field2: 'value2
            },
            batchOrder: 2
        },
        {
            method: 'getFail',
            batchOrder: 0
        }
    );

Server usage:
=============
<!-- language: lang-php -->
            
    // Include server lib
    require_once('JsonRpcServer.php');

    // Your custom server API
    class Api {
        public function __construct() {

        }

        public function getFields() {
            $params = array();
            $params['field1'] = 'value1';
            $params['field2'] = 'value2';
            $params['field3'] = 'value3';
            return $params;
        }

        public function saveFields($params) {
            return count($params);
        }
    };
    
    // Setup your server
    $server = new jsonRPC(new Api());
    
    // Start requests handling
    $server->start();
    
Live demo: 
==========
http://mindsaur.com/demo/jsonrpc
