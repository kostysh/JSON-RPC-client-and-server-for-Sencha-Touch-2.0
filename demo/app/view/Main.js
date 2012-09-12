Ext.define('Jsonrpc.view.Main', {
    extend: 'Ext.tab.Panel',
    xtype: 'main',
    
    requires: [
        'Ext.TitleBar',
        'Ext.form.Panel',
        'Ext.form.FieldSet',
        'Ext.Spacer'
    ],
    
    config: {
        tabBarPosition: 'bottom',

        items: [
            {
                title: 'Welcome',
                iconCls: 'home',

                styleHtmlContent: true,
                
                layout: 'fit',
                items: [
                    {
                        docked: 'top',
                        xtype: 'titlebar',
                        title: 'JSON RPC Client for Sencha Touch'
                    },
                    
                    {
                        xtype: 'formpanel',
                        id: 'mainForm',

                        items: [
                            {
                                xtype: 'fieldset',

                                items: [
                                    {
                                        xtype: 'textfield',
                                        label: 'Field1:',
                                        name: 'field1'
                                    },
                                    {
                                        xtype: 'textfield',
                                        label: 'Field2:',
                                        name: 'field2'
                                    },
                                    {
                                        xtype: 'textfield',
                                        label: 'Field3:',
                                        name: 'field3'
                                    }
                                ]
                            },

                            {
                                xtype: 'button',
                                text: 'Send fields to server',
                                ui: 'confirm',
                                id: 'sendBtn'
                            },

                            {
                                xtype: 'spacer',
                                height: 20
                            },

                            {
                                xtype: 'button',
                                text: 'Get fields from server',
                                id: 'getBtn'
                            },

                            {
                                xtype: 'spacer',
                                height: 20
                            },

                            {
                                xtype: 'button',
                                text: 'Beautiful batch request',
                                ui: 'action',
                                id: 'beautifulBatchBtn'
                            },
                            
                            {
                                xtype: 'spacer',
                                height: 20
                            },
                            
                            {
                                xtype: 'button',
                                text: 'Batch request with one unknown method',
                                ui: 'decline',
                                id: 'batchBtn'
                            },

                            {
                                xtype: 'spacer',
                                height: 20
                            },

                            {
                                xtype: 'button',
                                text: 'Single request with unknown method',
                                ui: 'decline',
                                id: 'errBtn'
                            }
                        ]
                    }
                ]
            },
            
            {
                title: 'About',
                iconCls: 'info',
                layout: 'fit',
                styleHtmlContent: true,
                html: '<p><strong>JSON-RPC-client-and-server-for-Sencha-Touch-2.0 demo</strong></p>' +
                      '<p>Version: 2.1 Beta</p>' +
                      '<p>Author: Constantine Smirnov, <a href="http://mindsaur.com">http://mindsaur.com</a></p>' +
                      '<p>License: GNU GPL v3.0</p>' +
                      '<p>GitHub: <a href="https://github.com/kostysh/JSON-RPC-client-and-server-for-Sencha-Touch-2.0">JSON-RPC-client-and-server-for-Sencha-Touch-2.0</a></p>',
                scrollable: 'vertical'
            }
        ]
    }
});
