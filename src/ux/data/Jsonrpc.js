/**
 * @filename Jsonrpc.js
 *
 * @name JsonRPC client
 * @fileOverview JSON-RPC spec. version 2.0 conformed client for Sencha Touch
 *
 * @author Constantine V. Smirnov kostysh(at)gmail.com
 * @date 20120818
 * @version 2.0.1
 * @license GNU GPL v3.0
 *
 * @requires Sencha Touch 2.0
 * @requires Ext.mixin.Observable 
 * @requires Ext.data.Connection
 * @requires Ext.data.identifier.Uuid
 * @requires Ext.util.MixedCollection
 * 
 * Usage:
    
    // JsonRPC client initialization 
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
  
 */

/**
    Request configuration sample
    ...
    {
        method: 'remoteMethodName',
        params: { // named parameters to be passed to the remote method
            param1: 'value1',
            param2: 'value2
        },
        scope: this, // Scope for callback (optional)
        batchOrder: 1 // for batch requests only
    }
 
 */

/**
 * @event beforeinitialized
 * Fires before when client is initialized
 */

/**
 * @event initialized
 * Fires when client is initialized
 */

/**
 * @event exception
 * Fires whenever runtime callback error
 * @param {object} err Error object
 */

/**
 * @event beforeresult
 * Fires beforeresult process
 * @param {object} result Result object
 */

Ext.define('Ext.ux.data.Jsonrpc', {
    mixins: {
        observable: 'Ext.mixin.Observable'
    },
    
    requires: [
        'Ext.data.Connection',
        'Ext.data.identifier.Uuid',
        'Ext.util.MixedCollection'
    ],
    
    /**
     * Connection manager
     * @private
     */
    connection: null,
    
    /**
     * Uuid generator (RFC-4122)
     * @private
     * 
     * Usage:
      
        var newUuid = this.uuid.generate();
    
     * 
     */
    uuid: null,
    
    /**
     * Requests collection
     * @private
     */
    requests: null,
    
    /**
     * Request hooks
     * @private
     */
    requestHooks: {},
    
    /**
     * Initialization flag
     * @private
     * @cfg {Boolean} initialized 
     */
    initialized: false,
    
    config: {
        
        /**
         * JsonRPC client configuration
         * @cfg {String} url URL to JSON-RPC server
         * @cfg {Object} api Callbacks for remote procedures
         * @cfg {Integer} timeout Timeout before connection abort (in milliseconds)
         * @cfg {Object} scope Default scope for RPC callbacks
         */
        
        url: '',
        api: null,
        timeout: 30000,
        scope: window
    },
    
    /**
     * Constructor
     * @private
     */
    constructor: function(config) {
        var me = this;
        me.initConfig(config);
        
        // Build connection instance
        me.connection = Ext.create('Ext.data.Connection', {
            useDefaultXhrHeader: false
        });
        
        // Requests collection
        me.requests = Ext.create('Ext.util.MixedCollection');
        
        // UUID generator setup
        me.uuid = Ext.create('Ext.data.identifier.Uuid');
        
        me.fireAction('beforeinitialized', [me], me.setInitialized);
    },
    
    /**
     * @private
     */
    setInitialized: function() {
        var me = this;
        me.initialized = true;
        me.fireEvent('initialized');
    },
    
    /**
     * @private
     */
    beforeInitConfig: function() {
        var me = this;
        
        // Subscribe to client exception event
        me.on({
            scope: me,
            exception: me.onException
        });
    },
    
    /**
     * Define callback methods for remote api
     * @method
     * @param {Object} api Object with api methods config
     */
    applyApi: function(api) {
        
        // @todo Deep validation for api methods
        if (!Ext.isObject(api)) {
            var err = {
                title: 'Configuration error',
                message: 'Wrong api configuration object',
                time: new Date()
            };            
            this.fireEvent('exception', err);            
            return null;
        }
        
        return Ext.apply({
            
            // Default error callback (if not defined in api config)
            error: function(err) {
                console.log('jsonRPC client error:', err.message);
            }
        }, api);
    },
    
    /**
     * @private
     */
    updateScope: function(scope) {
        if (!Ext.isObject(scope)) {
            scope = this;
        }
        
        return scope;
    },
    
    /**
     * Register request
     * @private
     * @return {Object} The request added
     */
    registerRequest: function(id, config) {
        this.requests.add(id, config);
    },
    
    /**
     * Remove registered request by id
     * @private
     * @return {Object} The request removed or false if no request was removed
     */
    removeRequest: function(id) {
        return this.requests.removeAtKey(id);
    },
    
    /**
     * Get request object by id
     * @return {Object} The request object
     */
    getRequest: function(id) {
        return this.requests.get(id);
    },
    
    /**
     * Verify is callback for remote procedure was defined
     */
    isCallbackDefined: function(config) {
        var api = this.getApi();
        
        if (Ext.isDefined(config.method) && 
            !Ext.isFunction(api[config.method])) {
            
            // <debug>
            if (Ext.isDefined(config.id) && config.id !== null) {
                this.fireEvent('exception', {
                    title: 'Configuration error',
                    message: 'Callback for remote procedure [' + 
                             config.method + 
                             '] not defined!',
                    time: new Date()
                });
            }   
            // </debug>
            
            return false;
        } else {
            return true;
        }
    },
    
    /**
     * Build request
     * @private
     * @return {String} Request object in JSON format
     */
    buildRequest: function(config) {
        var me = this;
        var uuid;
        var idPart = {};
        
        config.scope = config.scope || me.getScope();
        
        // Generate unique Id for request
        uuid = me.uuid.generate();
        
        // Do not set Id for notice requests (with id === null)
        // @todo Validate request Id to be String or number without fractional parts
        if (Ext.isDefined(config.id) && config.id !== null) {
            idPart = {id: config.id};
        } else if (!Ext.isDefined(config.id)) {
            idPart = {id: uuid};
        }
        
        // Register requests with enabled callback
        if (me.isCallbackDefined(config)) {
            me.registerRequest(uuid, config);
        }
        
        // Add params property if non empty only
        if (Ext.isDefined(config.params) && config.params !== null) {
            idPart = Ext.apply(idPart, {
                params: config.params
            })
        }
                
        return Ext.encode(Ext.apply({
            jsonrpc: '2.0',
            method: config.method            
        }, idPart));
    },
    
    /**
     * Process result obtained from server
     * @private
     */    
    processResult: function(result) {
        var self = this;
        var api = self.getApi();
        
        if (Ext.isDefined(result.error)) {

            // We got error mesage from server
            result.error.title = 'Server message';
            self.fireEvent('exception', result.error);
            return;
        }
        
        // Get registered request from collection
        var registered = self.getRequest(result.id);
        
        if (Ext.isDefined(registered)) {
            
            // Work with non-empty results only
            if (Ext.isDefined(result.result) && 
                self.fireEvent('beforeresult', result) !== false) {

                api[registered.method].apply(registered.scope || 
                                             self.getScope(), 
                                             [result.result]);
            }
            
            // Unregister processed request
            self.removeRequest(result.id);
        } else {
            
            // @todo Move msg about undefined callback to debug on production
            self.fireEvent('exception', {
                title: 'Request error',
                message: 'Server response contains unregistered request ID ' + 
                         'or notice request filed!',
                time: new Date()
            });
        }
    },
    
    /**
     * Send an JSON-RPC request to a remote server
     * @cfg {object} config Single or multiple requests configs
     */    
    request: function() {
        var me = this;
        var requestsArgs = Ext.clone(arguments);
        
        
        if (!me.initialized) {
            
            // Wait for initialized event and recall method
            me.on({
                single: true,
                initialized: function() {
                    me.requset.apply(me, requestsArgs);
                }
            });
            
            return;
        }
        
        // Temporary builded requests collection
        var requests = Ext.create('Ext.util.MixedCollection'); 
        
        // Default batch wrapper
        var batchPrefix = ''; 
        var batchPostfix = '';
        
        // Build each request config from arguments
        for (var i in arguments) {
            var request = me.buildRequest(arguments[i]);
            
            if (request) {
                
                // Add builded request to collection
                requests.add(requests.getCount() + 1, {
                    request: request,
                    batch: arguments[i].batchOrder || 0
                });
            }                
        }
        
        // Sort requests by batch order
        requests.sort('batch', 'ASC');
        
        // Concatenate batch requests
        var parsedRequest = '';
        requests.each(function(item, index, length) {
            parsedRequest += item.request;
            
            if (index < length - 1) {
                parsedRequest += ',';
            }
        });
        
        // Update batch wrapper
        if (requests.getCount() > 1) {
            batchPrefix = '[';
            batchPostfix = ']'
        }
        
        if (requests.getCount() > 0) {
            
            var requestConfig = {
                url: me.getUrl(),
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: me.getTimeout(),
                jsonData: batchPrefix + parsedRequest + batchPostfix,
                success: function() {
                    try {
                        var result = Ext.decode(arguments[2].responseText);

                        if (Ext.isArray(result)) {
                            for (var i in result) {
                                me.processResult(result[i]);
                            }
                        } else {
                            me.processResult(result);
                        }
                    } catch(err) {
                        me.fireEvent('exception', err);
                    }
                },
                failure: function(response, opts) {
                    me.fireEvent('exception', {
                        title: 'Connection error',
                        message: 'Server not respond. <br/>Try again later, please',
                        response: response,
                        opts: opts,
                        time: new Date()
                    });
                }
            };
            
            // Request hooks is a feature for injecting 
            // extra common parameters to requestConfig
            // @private
            if (Ext.isObject(me.requestHooks)) {
                Ext.merge(requestConfig, me.requestHooks);
            }
            
            // Send request with Ext.data.Connection
            me.connection.request(requestConfig);
        }
    },
    
    /**
     * @private
     */
    onException: function(err) {
        var me = this;
        var api = me.getApi();
        
        if (Ext.isFunction(api['error'])) {
            if (!Ext.isDefined(err.title)) {
                err.title = 'Exception';
            }
            
            api['error'].apply(me, [err]);
        }
    }

});