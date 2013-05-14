/**
 * @filename Jsonrpc.js
 *
 * @name JsonRPC client
 * @fileOverview JSON-RPC spec. version 2.0 conformed client for Sencha Touch
 *
 * @author Constantine V. Smirnov kostysh(at)gmail.com
 * @date 20120913
 * @version 2.1 Beta
 * @license GNU GPL v3.0
 * 
 * @thanks for toXmlRpc/parseXmlRpc to http://code.google.com/p/json-xml-rpc/
 *
 * @requires Sencha Touch 2.0
 * @requires Ext.mixin.Observable 
 * @requires Ext.data.Connection
 * @requires Ext.data.identifier.Uuid
 * @requires Ext.util.MixedCollection
 * @requires Ext.DateExtras
 * 
 * Usage:
    
    // JsonRPC client initialization
    var jsonRPC = Ext.create('Ext.ux.data.Jsonrpc', {
        url: 'http://path-to-your-server/rpc',
        protocol: 'JSON-RPC',// or XML-RPC
        timeout: 20000,
        scope: me,
        
        // Remote API definition
        api: [
            {
                name: 'getFields'
            },
            {
                name: 'saveFields',
                model: 'Jsonrpc.model.SaveFields'// Ext.data.Model config for parameters fields 
            }
        ],

        // Hooks - these callbacks will be called before regular callbacks
        // you can manipulate result value inside
        hooks: {
            getFields: function(result) {

                // <debug>
                if (Ext.isObject(result)) {
                    console.log('Server response: ', result);
                }
                // </debug>

                return result;
            },
            saveFields: function(result) {

                // <debug>
                console.log('Server response: ', result);
                // </debug>

                return result;
            }
        },
        
        // Default exception handler
        error: function(err) {
            Ext.device.Notification.show({
                title: err.title || 'Fail!',
                message: err.message || 'Unknown error'
            });
        }
    });
        
    // Single request to 'getFields' remote method
    jsonRPC.getFields(function(fields) {
        me.getForm().setValues(fields);
    });
        
    // Single request to 'saveFields' remote method
    // @param {Object/Array/Function} Data fields (named or by-position), callback function
    jsonRPC.saveFields(values, function(result) {
        Ext.device.Notification.show({
            title: 'Server response',
            message: result
        });
    });
    
    // Batch request
    jsonRPC.request(
        {
            method: 'saveFields',
            params: form.getValues(),
            batchOrder: 2,
            callback: function(result) {
                console.log('Server response: ', result);
            }
        },
        {
            method: 'getFields',
            batchOrder: 1
        }
    );
  
 */

/**
    Raw request configuration sample
    ...
    {
        method: 'remoteMethodName',
        params: { // named parameters to be passed to the remote method
            param1: 'value1',
            param2: 'value2
        },
        scope: this, // Scope for callback (optional)
        batchOrder: 1,// Batch sorting order (optional), for batch requests only
        callback: function() {
            // Method callback (optional)
            // ...
        } 
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
        'Ext.data.Field',
        'Ext.data.ModelManager',
        'Ext.data.Model',
        'Ext.util.MixedCollection',
        'Ext.DateExtras'
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
     * Remote methods local aliases collection
     * @private
     */
    aliases: {},
    
    /**
     * Requests collection
     * @private
     */
    requests: null,
    
    /**
     * Request hooks
     * @private
     */
    requestsHooks: null,
    
    /**
     * Initialization flag
     * @private
     * @cfg {Boolean} initialized 
     */
    initialized: false,
    
    config: {
        
        /**
         * JsonRPC client configuration
         * @cfg {String} protocol Base protocol type. JSON-RPC/XML-RPC
         * @cfg {String} url URL to JSON-RPC server
         * @cfg {Object} api Remote procedures config
         * @cfg {Object} hooks Remote procedures response hooks config
         * @cfg {Function} error Default error callback
         * @cfg {Integer} timeout Timeout before connection abort (in milliseconds)
         * @cfg {Object} scope Default scope for RPC callbacks
         */
        
        protocol: 'JSON-RPC',
        url: '',
        api: null,
        hooks: null,
        error: null,
        timeout: 30000,
        scope: window,
        
        /**
         * Base http headers for requests
         * @private
         * @cfg {Object} headers Key-value object with headers
         * @cfg {Object} extraHeaders Key-value object with additional headers
         */
        headers: {},
        extraHeaders: {}
    },
    
    /**
     * Constructor
     * @private
     */
    constructor: function(config) {
        var me = this;
        
        // Build connection instance
        me.connection = Ext.create('Ext.data.Connection', {
            useDefaultXhrHeader: false
        });
        
        // Requests collection
        me.requests = Ext.create('Ext.util.MixedCollection');
        
        // Requests hooks collection
        me.requestsHooks = Ext.create('Ext.util.MixedCollection');
        
        // Methods aliases collection
        me.aliases = Ext.create('Ext.util.MixedCollection');
        
        // UUID generator setup
        me.uuid = Ext.create('Ext.data.identifier.Uuid');
        
        me.initConfig(config);
        
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
     * @private
     */
    getMethodNameByAlias: function(alias) {
        var method = this.aliases.getByKey(alias);
        if (method) {
            return method;
        } else {
            return alias;
        }
    },
    
    /**
     * @private
     */
    escapeString: function(value) {
        var HTML_SPEC_CHAR = {
            '<': '&lt;',
            '>': '&gt;',
            '&': '&amp;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return value.replace(/[<>&"']/, function(ch){
            return HTML_SPEC_CHAR[ch];
        });
    },
    
    /**
     * @private
     */
    dateToISO8601: function(date){
        return Ext.Date.format(date, Ext.Date.patterns.ISO8601Long);
    },
    
    /**
     * @private
     */
    toXmlRpc: function(value){
        var me = this;
        var xml = ['<value>'];
        
        switch(typeof value){
            case 'number':
                if (!isFinite(value))
                    xml.push('<nil/>');
                else if (parseInt(value) == Math.ceil(value)){
                    xml.push('<int>');
                    xml.push(value.toString());
                    xml.push('</int>');
                }
                else {
                    xml.push('<double>');
                    xml.push(value.toString());
                    xml.push('</double>');
                }
                break;
            
            case 'boolean':
                xml.push('<boolean>');
                xml.push(value ? '1' : '0');
                xml.push('</boolean>');
                break;
            
            case 'string':
                xml.push('<string>');
                xml.push(me.escapeString(value)); 
                xml.push('</string>');
                break;
            
            case 'object':
                if(value === null) {
                    xml.push('<nil/>');
                } else if (value instanceof Array){
                    xml.push('<array><data>');
                    for (var i = 0; i < value.length; i++) {
                        xml.push(me.toXmlRpc(value[i]));
                    }                        
                    xml.push('</data></array>');
                } else if (value instanceof Date){
                    xml.push('<dateTime.iso8601>' + me.dateToISO8601(value) + '</dateTime.iso8601>');
                } else if (value instanceof Number || 
                           value instanceof String || 
                           value instanceof Boolean) {
                           
                    return me.dateToISO8601(value.valueOf());
                } else {
                    xml.push('<struct>');
                    var useHasOwn = {}.hasOwnProperty ? true : false; //From Ext's JSON.js
                    for (var key in value){
                        if(!useHasOwn || value.hasOwnProperty(key)){
                            xml.push('<member>');
                            xml.push('<name>' + me.escapeString(key) + '</name>');
                            xml.push(me.toXmlRpc(value[key]));
                            xml.push('</member>');
                        }
                    }
                    xml.push('</struct>');
                }
                break;
            
            case 'undefined':
            case 'function':
            case 'unknown':
                break;
            
            default:
                me.fireEvent('exception', {
                    title: 'Data type error',
                    message: 'Unable to convert the value of type ' +
                             '"' + typeof(value) + '" to XML-RPC format',
                    time: new Date()
                });
                return '';
        }
        xml.push('</value>');
        return xml.join('');
    },
    
    /**
     * @private
     */
    parseXmlRpc: function(valueEl){
        var me = this;
        
        if(valueEl.childNodes.length == 1 &&
           valueEl.childNodes.item(0).nodeType == 3) {
            
            return valueEl.childNodes.item(0).nodeValue;
        }
        
        for (var i=0; i < valueEl.childNodes.length; i++) {
            
            if (valueEl.childNodes.item(i).nodeType === 1) {
                
                var typeEL = valueEl.childNodes.item(i);
                switch (typeEL.nodeName.toLowerCase()) {
                    case 'i4':
                    case 'int':
                        //An integer is a 32-bit signed number. You can include a plus or minus at the
                        //   beginning of a string of numeric characters. Leading zeros are collapsed.
                        //   Whitespace is not permitted. Just numeric characters preceeded by a plus or minus.
                        var intVal = parseInt(typeEL.firstChild.nodeValue);
                        
                        if (isNaN(intVal)) {
                            me.fireEvent('exception', {
                                title: 'XML-RPC Parse Error',
                                message: "The value provided as an integer '" +
                                         '"' + typeEL.firstChild.nodeValue + "' is invalid.",
                                time: new Date()
                            });
                            return '';
                        }   
                        
                        return intVal;
                        
                    case 'double':
                        //There is no representation for infinity or negative infinity or "not a number".
                        //   At this time, only decimal point notation is allowed, a plus or a minus,
                        //   followed by any number of numeric characters, followed by a period and any
                        //   number of numeric characters. Whitespace is not allowed. The range of
                        //   allowable values is implementation-dependent, is not specified.
                        var floatVal = parseFloat(typeEL.firstChild.nodeValue);
                        
                        if (isNaN(floatVal)) {
                            me.fireEvent('exception', {
                                title: 'XML-RPC Parse Error',
                                message: "The value provided as a double '" +
                                         '"' + typeEL.firstChild.nodeValue + "' is invalid.",
                                time: new Date()
                            });
                            
                            return '';
                        }
                            
                        return floatVal;
                    
                    case 'boolean':
                        if (typeEL.firstChild.nodeValue != '0' && 
                            typeEL.firstChild.nodeValue != '1') {
                            
                            me.fireEvent('exception', {
                                title: 'XML-RPC Parse Error',
                                message: "The value provided as a boolean '" +
                                         '"' + typeEL.firstChild.nodeValue + "' is invalid.",
                                time: new Date()
                            });
                            
                            return '';
                        }
                        
                        return Boolean(parseInt(typeEL.firstChild.nodeValue));
                    
                    case 'string':
                        if (!typeEL.firstChild) {
                            return "";
                        }
                            
                        return typeEL.firstChild.nodeValue;
                    
                    case 'datetime.iso8601':
                        var matches, date = new Date(0);
                        
                        if (matches = typeEL.firstChild.nodeValue.match(/^(?:(\d\d\d\d)-(\d\d)(?:-(\d\d)(?:T(\d\d)(?::(\d\d)(?::(\d\d)(?:\.(\d+))?)?)?)?)?)$/)){
                            if(matches[1]) date.setUTCFullYear(parseInt(matches[1]));
                            if(matches[2]) date.setUTCMonth(parseInt(matches[2]-1));
                            if(matches[3]) date.setUTCDate(parseInt(matches[3]));
                            if(matches[4]) date.setUTCHours(parseInt(matches[4]));
                            if(matches[5]) date.setUTCMinutes(parseInt(matches[5]));
                            if(matches[6]) date.setUTCMilliseconds(parseInt(matches[6]));
                            
                            return date;
                        }
                        
                        me.fireEvent('exception', {
                            title: 'XML-RPC Parse Error',
                            message: 'The provided value does not match ISO8601',
                            time: new Date()
                        });
                        
                        return '';
                    
                    case 'base64':
                        return me.decode64(typeEL.firstChild.nodeValue);
                    
                    case 'nil':
                        return null;
                    
                    case 'struct':
                        //A <struct> contains <member>s and each <member> contains a <name> and a <value>.
                        var obj = {};
                        
                        for (var memberEl, j = 0; memberEl = typeEL.childNodes.item(j); j++) {
                            if (memberEl.nodeType == 1 && memberEl.nodeName == 'member') {
                                var name = '';
                                valueEl = null;
                                for (var child, k = 0; child = memberEl.childNodes.item(k); k++) {
                                    if (child.nodeType == 1) {
                                        if(child.nodeName == 'name') {
                                            name = child.firstChild.nodeValue;
                                        } else if (child.nodeName == 'value') {
                                            valueEl = child;
                                        }                                            
                                    }
                                }
                                //<struct>s can be recursive, any <value> may contain a <struct> or
                                //   any other type, including an <array>, described below.
                                if(name && valueEl) {
                                    obj[name] = me.parseXmlRpc(valueEl);
                                }                                    
                            }
                        }
                        return obj;
                    
                    case 'array':
                        //An <array> contains a single <data> element, which can contain any number of <value>s.
                        var arr = [];
                        var dataEl = typeEL.firstChild;
                        
                        while(dataEl && (dataEl.nodeType != 1 || dataEl.nodeName != 'data')) {
                            dataEl = dataEl.nextSibling;
                        }
                    
                        if(!dataEl) {
                            me.fireEvent('exception', {
                                title: 'XML-RPC Parse Error',
                                message: "Expected 'data' element as sole child element of 'array'",
                                time: new Date()
                            });

                            return '';
                        }
                    
                        valueEl = dataEl.firstChild;
                        
                        while(valueEl){
                            if(valueEl.nodeType == 1){
                                //<arrays>s can be recursive, any value may contain an <array> or
                                //   any other type, including a <struct>, described above.
                                if(valueEl.nodeName == 'value') {
                                    arr.push(me.parseXmlRpc(valueEl));
                                } else {
                                    me.fireEvent('exception', {
                                        title: 'XML-RPC Parse Error',
                                        message: "Illegal element child '" + valueEl.nodeName + "' of an array's 'data' element",
                                        time: new Date()
                                    });

                                    return '';
                                }
                            }
                            valueEl = valueEl.nextSibling;
                        }
                        return arr;
                    
                    default:
                        me.fireEvent('exception', {
                            title: 'XML-RPC Parse Error',
                            message: "Illegal element '" + typeEL.nodeName + "' child of the 'value' element",
                            time: new Date()
                        });

                        return '';
                }
            }
        }
        
        return '';
    },
    
    /**
     * @private
     */
    extractXmlRpcValueEl: function(dom) {
        var valueEl = dom.getElementsByTagName('value')[0];
        if(valueEl.parentNode.nodeName == 'param' &&
           valueEl.parentNode.parentNode.nodeName == 'params') {
            
            return valueEl;
        } else {
            return undefined;
        }
    },
    
    /**
     * @private
     */
    decode64: function(input) {
        var keyStr = "ABCDEFGHIJKLMNOP" +
                     "QRSTUVWXYZabcdef" +
                     "ghijklmnopqrstuv" +
                     "wxyz0123456789+/" +
                     "=";
        var output = "";
        var chr1, chr2, chr3 = "";
        var enc1, enc2, enc3, enc4 = "";
        var i = 0;

        // remove all characters that are not A-Z, a-z, 0-9, +, /, or =
        input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

        do {
            enc1 = keyStr.indexOf(input.charAt(i++));
            enc2 = keyStr.indexOf(input.charAt(i++));
            enc3 = keyStr.indexOf(input.charAt(i++));
            enc4 = keyStr.indexOf(input.charAt(i++));

            chr1 = (enc1 << 2) | (enc2 >> 4);
            chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
            chr3 = ((enc3 & 3) << 6) | enc4;

            output = output + String.fromCharCode(chr1);

            if (enc3 != 64) {
                output = output + String.fromCharCode(chr2);
            }
            if (enc4 != 64) {
                output = output + String.fromCharCode(chr3);
            }

            chr1 = chr2 = chr3 = "";
            enc1 = enc2 = enc3 = enc4 = "";

        } while (i < input.length);

        return unescape(output);
    },
    
    /**
     * @private
     */
    applyProtocol: function(protocol) {
        switch (protocol) {
            case 'JSON-RPC':
            case 'XML-RPC':
                return protocol;
            default: 
                return 'JSON-RPC';
        }
    },
    
    /**
     * @private
     */
    updateProtocol: function(protocol) {
        var me = this;
        if (Ext.isDefined(protocol) && protocol === 'XML-RPC') {
            me.setHeaders({
                'Content-Type': 'text/xml',
                'Accept': 'text/xml'
            });
        } else {
            me.setHeaders({
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            });
        }
    },
    
    /**
     * @private
     */
    addRequestMethod: function(name, model) {
        var me = this;
        
        me[name] = (function(methodName, paramsModel) {
            return function() {
                var requestParams = null;
                var rawParams;
                var fieldsSortOrder = null;
                var callback = Ext.emptyFn();
                var args = Ext.clone(arguments);
                
                // Extract callback and parameters from arguments
                for (var i in arguments) {
                    if (Ext.isFunction(arguments[i])) {
                        callback = arguments[i];
                    } else {
                        if (!rawParams) {
                            if (Ext.isArray(arguments[i]) || 
                                Ext.isPrimitive(arguments[i])) {
                                rawParams = [];
                            } else {
                                rawParams = {};
                            }
                        }
                        
                        if (Ext.isArray(rawParams)) {
                            if (Ext.isArray(arguments[i])) {
                                rawParams = rawParams.concat(arguments[i]);
                            }
                            if (Ext.isPrimitive(arguments[i])) {
                                rawParams.push(arguments[i]);
                            }
                            if (Ext.isObject(arguments[i])) {
                                for (var y in arguments[i]) {
                                    rawParams.push(arguments[i][y]);
                                }
                            }
                        } else {
                            if (Ext.isObject(arguments[i])) {
                                Ext.apply(rawParams, arguments[i]);
                            }
                        }
                    }
                }
                                
                requestParams = rawParams;
                
                // Extract fieldsSortOrder from parameters
                if (Ext.isObject(requestParams) && 
                    Ext.isDefined(requestParams.fieldsSortOrder)) {
                    
                    fieldsSortOrder = requestParams.fieldsSortOrder;
                }
                
                var model = Ext.data.ModelManager.getModel(paramsModel);
                
                // Validate parameters if model is defined
                if (model) {
                    var model = Ext.create(model, requestParams);
                    var errors = model.validate();
                    if (!errors.isValid()) {
                        var message = [];

                        for (var i in errors.items) {
                            var error = errors.items[i];
                            message.push('"' + error.getField() + '" ' + 
                                         error.getMessage());
                        }
                        
                        me.fireEvent('exception', {
                            title: 'Error while remote procedure calling',
                            message: 'Wrong parameters!</br>' + message.join(''),
                            time: new Date()
                        });
                        return;
                    } else {
                        requestParams = model.getData();
                    }
                }
                
                // If id not defined in model directly 
                // we should remove model internal id from parameters
                if (model && model.internalId === model.getId()) {
                    delete requestParams['id'];
                }
                
                var actionCfg = {
                    method: me.getMethodNameByAlias(methodName),// Convert alias to real method name
                    callback: callback
                };
                
                if (Ext.isDefined(requestParams)) {
                    
                    // If fieldsSortOrder is defined we should convert
                    // named parameters object to sorted array (by order pos)
                    if (fieldsSortOrder && Ext.isArray(fieldsSortOrder)) {
                        var sorted = [];
                        for (var i in fieldsSortOrder) {
                            if (fieldsSortOrder[i] in requestParams) {
                                sorted.push(requestParams[fieldsSortOrder[i]]);
                            }                            
                        }
                        requestParams = sorted;
                    }                    
                    
                    Ext.apply(actionCfg, {
                        params: requestParams
                    })
                }
                
                // Do request to remote server
                me.request(actionCfg);
            };
        })(name, model);
    },
    
    /**
     * Remote api
     * @private
     * @param {Object} api Remote api config object
     */
    applyApi: function(api) {
        var me = this;
        
        if (!Ext.isArray(api)) {
            me.fireEvent('exception', {
                title: 'Configuration error',
                message: 'Wrong api configuration',
                time: new Date()
            });            
            return null;
        } 
            
        for (var i in api) {
            var method = api[i];

            // Name must be defined for remote procedure
            if (!Ext.isDefined(method['name'])) {
                me.fireEvent('exception', {
                    title: 'Configuration error',
                    message: 'Wrong remote procedure configuration. ' +
                             'Procedure name not defined!',
                    time: new Date()
                });
                return null;
            }

            var model = null;

            // Validate the configuration of parameters for remote procedure
            // Before all, check for model configuration
            if (Ext.isDefined(method['model'])) {
                model = method['model'];

                if (!Ext.data.ModelManager.getModel(method['model'])) {
                    me.fireEvent('exception', {
                        title: 'Configuration error',
                        message: 'Wrong remote procedure configuration. ' +
                                 'Model for "' + method['name'] + '" not found!',
                        time: new Date()
                    });
                    return null;
                }
            } else {

                // If model not defined we create one
                // but check for parameters configuration before
                if (Ext.isDefined(method['params']) && 
                    method['params'] !== null) {
                    model = 'RP' + method['name'] + 'Params';
                    Ext.define(model, {
                        extend: 'Ext.data.Model',
                        config: {
                            fields: method['params'],
                            validations: method['validations'] || null
                        }
                    });
                } 
            }
            
            // @todo Add alias validation
            if (method['name'].indexOf('.') !== -1 && 
                !Ext.isDefined(method['alias'])) {
                
                me.fireEvent('exception', {
                    title: 'Configuration error',
                    message: 'Alias for method "' + method['name'] + '" not defined!',
                    time: new Date()
                });
                return null;
            }

            // Build local callback for remote procedure
            if (Ext.isDefined(method['alias'])) {
                me.aliases.add(method['alias'], method['name']);// Register alias                
                me.addRequestMethod(method['alias'], model);
            } else {
                me.addRequestMethod(method['name'], model);
            }            
        }
                
        return api;
    },
    
    /**
     * Response hooks for remote api methods
     * @private
     * @param {Object} apiHooks Object with apiHooks methods config
     */
    applyHooks: function(apiHooks) {
        var me = this;
        
        if (!Ext.isObject(apiHooks)) {
            me.fireEvent('exception', {
                title: 'Configuration error',
                message: 'Wrong hooks configuration',
                time: new Date()
            });            
            return null;
        } else {
            for (var i in apiHooks) {
                if (Ext.isFunction(apiHooks[i])) {
                    me.requestsHooks.add(i, apiHooks[i]);
                }
            }
        }
        
        return apiHooks;
    },
    
    /**
     * Default error callback
     * @private
     * @param {Function} onError
     */
    applyError: function(onError) {
        if (!Ext.isFunction(onError)) {
            return function(err) {
                
                // <debug>
                console.log('RPC client error:', err.message);
                // </debug>
            };
        } else {
            return onError;
        }
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
     * @private
     * @param {String} is Request Id
     * @return {Object} The request object
     */
    getRequest: function(id) {
        return this.requests.get(id);
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
        config.callback = config.callback || Ext.emptyFn;
                
        // Do not set Id for notice requests (with id === null)
        // @todo Validate request Id to be String or number without fractional parts
        if (Ext.isDefined(config.id) && config.id !== null) {
            idPart = {id: config.id};
        } else if (!Ext.isDefined(config.id)) {
            
            // Generate unique Id for request
            uuid = me.uuid.generate();
            idPart = {id: uuid};
        }
        
        // Register requests 
        me.registerRequest(uuid, config);
        
        // Add params property if non empty only
        if (Ext.isDefined(config.params) && config.params !== null) {
            idPart = Ext.apply(idPart, {
                params: config.params
            })
        }
        
        if (me.getProtocol() === 'XML-RPC') {
            var xml = ['<methodCall><methodName>' + config.method + '</methodName>'];
            if (Ext.isDefined(idPart.id)) {
                xml.push('<id>' + idPart.id + '</id>');
            }
            
            if(config.params){
                xml.push('<params>');
                for (var i in config.params) {
                    xml.push('<param>' + me.toXmlRpc(config.params[i]) + '</param>');
                }                    
                xml.push('</params>');
            }
            xml.push('</methodCall>');
            
            return {
                id: idPart.id,
                request: xml.join('')
            };
            
        } else {
            return {
                id: idPart.id,
                request: Ext.encode(Ext.apply({
                    jsonrpc: '2.0',
                    method: config.method            
                }, idPart))
            };
        }
    },
    
    /**
     * Process result obtained from server
     * @private
     */    
    processResult: function(result) {
        var me = this;
        
        if (Ext.isDefined(result.error)) {

            // We got error mesage from server
            result.error.title = 'Server message';
            me.fireEvent('exception', result.error);
            return;
        }
        
        // Get registered request from collection
        var registered = me.getRequest(result.id);
        
        if (Ext.isDefined(registered)) {
            
            // Work with non-empty results only
            if (Ext.isDefined(result.result) && 
                me.fireEvent('beforeresult', result) !== false) {
                
                // Apply hook
                if (me.requestsHooks.containsKey(registered.method)) {
                    result.result = me.requestsHooks.getByKey(registered.method).apply(me, [result.result]);
                }
                
                registered.callback.apply(registered.scope || 
                                          me.getScope(), 
                                          [result.result]);
            }
            
            // Unregister processed request
            me.removeRequest(result.id);
        } else {
            
            // @todo Move msg about undefined callback to debug on production
            me.fireEvent('exception', {
                title: 'Request error',
                message: 'Server response contains unregistered request ID ' + 
                         'or request with notice type is filed!',
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
        var xmlrpcRequestId;
        
        
        if (!me.initialized) {
            
            // Wait for initialized event and recall method
            me.on({
                single: true,
                initialized: function() {
                    me.request.apply(me, requestsArgs);
                }
            });
            
            return;
        }
        
        // Temporary requests collection 
        var requests = Ext.create('Ext.util.MixedCollection'); 
        
        // Default batch wrapper
        var batchPrefix = ''; 
        var batchPostfix = '';
        
        // Build each request config from arguments
        for (var i=0; i < arguments.length; i++) {
            var request = me.buildRequest(arguments[i]);
            
            if (request) {
                
                // Add builded request to collection
                requests.add(requests.getCount() + 1, {
                    id: request.id,
                    request: request.request,
                    batch: arguments[i].batchOrder || 0
                });
                
                // Official XML-RPC does not support batch requests in JSON-RPC sense
                // so in most cases regular XML-RPC request will be single
                // We should remember request id for server response identification
                if (me.getProtocol() === 'XML-RPC') {
                    xmlrpcRequestId = request.id;
                }
            }                
        }
        
        // Sort requests by batch order
        requests.sort('batch', 'ASC');
        
        // Concatenate batch requests
        var parsedRequest = '';
        requests.each(function(item, index, length) {
            parsedRequest += item.request;
            
            if (index < length - 1) {
                
                // Add batch separator for JSON requests only
                if (me.getProtocol() === 'JSON-RPC') {
                    parsedRequest += ',';
                }
            }
        });
        
        // Update batch wrapper
        if (requests.getCount() > 1) {
            if (me.getProtocol() === 'XML-RPC') {
                
                // @note !!! This type of batch request does not meet official XML-RPC spec
                // you can get exception with third party XML-RPC servers !!!
                batchPrefix = '<batch>';
                batchPostfix = '</batch>'
            } else {
                batchPrefix = '[';
                batchPostfix = ']'
            }
        }
        
        if (requests.getCount() > 0) {
            
            var requestConfig = {
                url: me.getUrl(),
                method: 'POST',
                headers: Ext.apply(me.getHeaders(), me.getExtraHeaders()),
                timeout: me.getTimeout(),
                success: function(response, opts) {
                    var result;
                    var batch = false;
                    
                    try {
                        if (me.getProtocol() === 'XML-RPC') {
                            var doc = response.responseXML.documentElement;
                            if(doc.nodeName !== 'methodResponse' && 
                               doc.nodeName !== 'batch') {
                                throw Error("Invalid XML-RPC document.");
                            }
                            
                            var fault = doc.getElementsByTagName('fault');
                            
                            if (fault.length > 0) {
                                if (fault[0].firstElementChild && 
                                    fault[0].firstElementChild.nodeName === 'value') {
                                    
                                    // Extract error message from server response
                                    var faultResult = me.parseXmlRpc(fault[0].firstElementChild);
                                    
                                    if (Ext.isDefined(faultResult.faultCode) && 
                                        Ext.isDefined(faultResult.faultString)) {
                                        
                                        // Build error object for result 
                                        result = {
                                            error: {
                                                code: faultResult.faultCode,
                                                message: faultResult.faultString
                                            }
                                        };
                                    } else {
                                        throw Error("Invalid XML-RPC fault response.");
                                    }
                                } else {
                                    throw Error("Invalid XML-RPC fault response.");
                                }
                                
                            } else {
                                if (doc.nodeName === 'batch') {
                                    batch = true;
                                    var responses = doc.getElementsByTagName('methodResponse');
                                    result = [];

                                    for (var i in responses) {
                                        if (Ext.isDefined(responses[i].nodeName)) {
                                            var valueEl = me.extractXmlRpcValueEl(responses[i]);
                                            if (valueEl !== undefined) {
                                                var parsed = me.parseXmlRpc(valueEl);
                                                
                                                if (Ext.isObject(parsed) && 
                                                    Ext.isDefined(parsed['result'])) {
                                                    
                                                    // We got right result
                                                    result.push(parsed);
                                                } else {
                                                     
                                                    // Convert XML-RPC response 
                                                    // to JSON-RPC response type
                                                    result.push({
                                                        id: xmlrpcRequestId || null,
                                                        result: parsed
                                                    });
                                                }
                                            }                                        
                                        }                                    
                                    }

                                } else {
                                    var valueEl = me.extractXmlRpcValueEl(doc);
                                    
                                    if(valueEl !== undefined) {
                                        var parsed = me.parseXmlRpc(valueEl);
                                        
                                        if (Ext.isObject(parsed) && 
                                            Ext.isDefined(parsed['result'])) {

                                            // We got right result
                                            result = parsed;
                                        } else {

                                            // Convert XML-RPC response 
                                            // to JSON-RPC response type
                                            result = {
                                                id: xmlrpcRequestId || null,
                                                result: parsed
                                            };
                                        }
                                    }
                                } 
                            }
                        } else {
                            result = Ext.decode(response.responseText);
                            
                            if (Ext.isArray(result) && 
                                result.length > 1 && 
                                Ext.isDefined(result[1]['result'])) {
                                
                                batch = true;
                            }
                        }
                        
                        if (batch && Ext.isArray(result)) {
                            for (var i in result) {
                                me.processResult(result[i]);
                            }
                        } else {
                            me.processResult(result);
                        }
                        
                    } catch(err) {
                        me.fireEvent('exception', err);
                        // <debug>
                        console.log('Error', err);
                        // </debug>
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
            
            parsedRequest = batchPrefix + parsedRequest + batchPostfix;
            
            if (me.getProtocol() === 'XML-RPC') {
                Ext.apply(requestConfig, {
                    xmlData: '<?xml version="1.0"?>' + parsedRequest
                });
            } else {
                Ext.apply(requestConfig, {
                    jsonData: parsedRequest
                });
            }
            
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
        
        if (Ext.isFunction(me.getError())) {
            if (!Ext.isDefined(err.title)) {
                err.title = 'Exception';
            }
            
            me.getError().apply(me, [err]);
        }
    }

});
