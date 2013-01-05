function voodoo( $, window, gapi, _, Backbone ) {

    /* Terminology:
        "update":  save client-side changes to server
        "refresh": pull data form server
    */

    /*
        Models
    */

    var debug = true;

    var log = function( s ) {
        if ( debug ) {
            console.log( s );
        }
    };

    var Task = Backbone.Model.extend({
        defaults: {
            id: null,
            title: '',
            completed: false,
            tasklist: '@default'
        },

        initialize: function( ){
            //alert("Welcome to this world");
            this.on( 'change:title', this.update );
            this.on( 'change:completed', this.update );
        },

        update: function() {
            var req = gapi.client.tasks.tasks.update({
                tasklist: this.get( 'tasklist' ),
                task: this.get('id'),
                resource: this.convertTo( true )
            });
            req.execute( function( res ) {
                // refresh
                log( 'Model:Task update' );
            });
        },

        save: function() {
            var req = gapi.client.tasks.tasks.insert({
                tasklist: this.get( 'tasklist' ),
                resource: this.convertTo( false )
            });
            var that = this;
            req.execute( function( res ) {
                // refresh
                that.set( 'id', res.id );
                log( 'Model:Task save' );
            });
        },

        refresh: function() {
            // refresh per API
        },

        destroy: function() {
            var req = gapi.client.tasks.tasks.delete({
                tasklist: this.get('tasklist'),
                task: this.get('id')
            });
            req.execute(function( res ) {
                // refresh tasks
                log("Model:Task destroyed");
            });
            //Backbone.Model.prototype.destroy.call(this, {});
            this.trigger( 'destroy' );
        },

        convertTo: function( includeID ) {
            var result = {
                title: this.get('title'),
                kind: "tasks#task",
                status: this.get('completed') ? 'completed' : 'needsAction'
            };
            if ( includeID ) {
                result.id = this.get('id');
            }
            return result;
        }
    });

    var List = Backbone.Model.extend({
        defaults: {
            //id: '@default',
            title: 'Untitled list',
            tasklist: null // TaskList collection
        },
        initialize: function( attributes ) {
            //this.set( attributes );
            if ( attributes && attributes.id == null ) {
                log( 'Creating new task list' );
            } else {
                this.tasklist = new TaskList([], {
                    id: this.get('id'),
                    title: this.get('title')
                });
            }
            this.on( 'change:title', this.update );
        },
        update: function() {
            log( 'Model:List update' );
            var req = gapi.client.tasks.tasklists.update({
                tasklist: this.get( 'id' ),
                resource: {
                    title: this.get( 'title' ),
                    id: this.get( 'id' )
                }
            });
            req.execute( function( res ) {
                //refreshTask( res );
                // refresh list of lists
            });
        },

        refresh: function() {
            // refresh per API
        },

        save: function( callback ) {
            var req = gapi.client.tasks.tasklists.insert({
                resource: this.convertTo()
            });
            var that = this;
            req.execute( function( res ) {
                // refresh
                that.tasklist = new TaskList([], {
                    id: res.id
                });
                log( 'Model:List save' );
            });
        },

        convertTo: function() {
            var result = {
                title: this.get('title')
            };
            return result;
        }
        
    });

    /*
        Collections
    */

    var TaskList = Backbone.Collection.extend({
        model: Task,

        initialize: function( models, options ) {
            this.id = options.id;
            this.title = options.title;
            this.refresh();
        },

        onLoad: function( response ) {
            this.reset();
            if ( response.items ) {
                response.items.forEach( _.bind( function(item, i) {
                    item.tasklist = this.id;
                    this.add( new Task( item ) );
                }, this ) );
            }
        },

        refresh: function() {
            log( 'Collection:TaskList refresh' );
            var request = gapi.client.tasks.tasks.list({
                tasklist: this.id
            });
            request.execute( _.bind( this.onLoad, this ) );
        },

        purge: function() {
            var req = gapi.client.tasks.tasks.clear({
                tasklist: this.id
            });
            var that = this;
            req.execute(function( res ) {
                log( 'Collection:TaskList purge' );
                that.refresh();
                // refresh
                // Refresh muss eventuell später erfolgen, da purge noch nicht ausgeführt ist, bevor call zurück kommt
            });
            
        }
    });

    var ListList = Backbone.Collection.extend({
        model: List,

        initialize: function() {
            var request = gapi.client.tasks.tasklists.list();
            request.execute( _.bind( this.onLoad, this ) );
        },

        onLoad: function( response ) {
            response.items.forEach( _.bind( function(item, i) {
                this.add( new List( item ) );
            }, this ) );
        }
    });

    /*
        Views
    */
    var TaskView = Backbone.View.extend({

        tagName: 'li',
        template: _.template( $('#task-template').html() ),

        initialize: function(){
            this.model.on( 'change', this.render, this );
            this.model.on( 'destroy', this.remove, this );
        },

        render: function() {
            log( 'View:Task render' );
            this.$el.html( this.template( this.model.toJSON() ) );
            //this.$el.toggleClass( 'completed', this.model.get('completed') );
            this.input = this.$('.edit');
            return this;
        },

        toggle: function( event ) {
            this.model.set( 'completed', $(event.target).is(':checked'));
        },

        doEdit: function( event ) {
            this.$('.title').hide();
            this.$('.edit').show().focus();
        },

        doKeypress: function( event ) {
            var input = $(event.target);
            if ( event.keyCode == 13 ) {
                event.preventDefault();
                input.hide();
                this.$('.title').show();
                this.model.set( 'title', input.val() );
            } else if ( event.keyCode == 27 ) {
                event.preventDefault();
                input.val( this.model.get( 'title' ) ).blur().hide();
                this.$('.title').show();
            }
        },

        doDelete: function() {
            log( 'View:Task delete' );
            var that = this;
            this.$el.slideUp( 300, function() {
                that.model.destroy();
                that.remove();
            });
        },

        events: {
            'click input.toggle': 'toggle',
            'click .title'  : 'doEdit',
            'keyup .edit': 'doKeypress',
            'click .delete': 'doDelete'
        }
    });

    var TaskListView = Backbone.View.extend({
        defaults: {
            collection: null,
            _taskViews: []
        },

        initialize: function( collection ) {
            if( this.collection ) {
                this.setBindings();
                this.render();
            }
        },

        render: function() {
            log( 'View:TaskList render' );
            var that = this;
            // Clear out this element.
            this.$el.find('ul.tasklist').empty();
            this.$el.find('h2').html( this.collection.title );
            // Render each sub-view and append it to the parent view's element.
            this.updateViews();
            _(this._taskViews).each( function( view ) {
                that.$el.find('ul.tasklist').append( view.render().el );
            });
        },

        setCollection: function( tasklist ) {
            this.collection = tasklist;
            this.updateViews();
            this.setBindings();
            this.render();
        },

        updateViews: function() {
            var that = this;
            this._taskViews = [];
            if ( this.collection ) {
                this.collection.each(function( task ) {
                    that._taskViews.push(new TaskView({
                        model : task
                    }));
                });
            }
        },

        setBindings: function() {
            this.collection.on( 'add', _.bind( this.render, this ) );
            this.collection.on( 'remove', _.bind( this.render, this ) );
        },

        doKeypress: function( event ) {
            var input = $(event.target);
            if ( event.keyCode == 13 ) {
                event.preventDefault();
                var title = input.val();
                var task = new Task({
                    title: title,
                    tasklist: this.collection.id
                });
                task.save();
                this.collection.unshift( task );
                input.val('');
            } else if ( event.keyCode == 27 ) {
                event.preventDefault();
                input.val( '' ).blur();
            }
        },

        doPurge: function( event ) {
            log( 'View:TaskList purge' );
            this.collection.purge();
        },

        doRefresh: function( event ) {
            log( 'View:TaskList refresh ');
            this.collection.refresh();
        },

        events: {
            'keyup .add': 'doKeypress',
            'click .purge': 'doPurge',
            'click .refresh': 'doRefresh'
        }
    });

    var ListView = Backbone.View.extend({
        tagName: 'li',
        template: _.template( $('#list-template').html() ),

        initialize: function(){
            this.model.on( 'change', this.render, this );
            this.model.on( 'destroy', this.remove, this );
        },

        render: function() {
            this.$el.html( this.template( this.model.toJSON() ) );
            this.input = this.$('.edit');
            return this;
        },

        events: {
            'click': 'chooseList',
            'keypress .edit': 'doKeypress'
        },

        doKeypress: function( event ) {
            if ( event.which == 13 ) {
                event.preventDefault();

                this.$('.title').show();
                this.$('.edit').hide();
                this.model.set( 'title', $(event.target).val() );
            }
        },

        chooseList: function( event ) {
            tlview.setCollection( this.model.tasklist );
        }

    });

    var AppView = Backbone.View.extend({
        _lists: [],

        initialize: function() {
            this.initCollection()
            this.setBindings();
        },

        initCollection: function() {
            var that = this;
            this._listViews = [];
            this.collection.each(function( list ) {
                that._listViews.push(new ListView({
                    model : list
                }));
            });
            this.render();
        },

        render: function() {
            log( 'View:App render' );
            var that = this;
            this.$el.find('ul.listlist').empty();
            _(this._listViews).each( function( view ) {
                that.$el.find('ul.listlist').append( view.render().el );
            });
            // doActivate?
            if (this._listViews.length > 0 ) {
                tlview.setCollection( _.first(this._listViews).model.tasklist );
            }
            var lis = this.$el.find('.listlist li');
            lis.removeClass('active');
            lis.first().addClass('active');
        },

        setBindings: function() {
            this.collection.on( 'change', this.render, this );
            this.collection.on( 'add', this.initCollection, this );
        },

        doActivate: function( event ) {
            this.$el.find('.listlist li').removeClass('active');
            var el = $(event.target).parents('li:first');
            if ( el.length === 0 ) {
                el = $(event.target);
            }
            el.addClass('active');
        },

        doKeypressAdd: function( event ) {
            var input = $( event.target );
            if ( event.keyCode == 13 ) {
                event.preventDefault();
                
                var title = input.val();

                var list = new List({
                    title: title
                });

                list.save();
                this.collection.unshift( list );
                input.val( '' ).blur().hide();
                this.$('.lists .toggle-add').html( 'New list' );
            } else if ( event.keyCode == 27 ) {
                event.preventDefault();
                input.val('').blur().slideUp( 300 );
                this.$('.lists .toggle-add').html( 'New list' );
            }
        },

        toggleAddList: function( event ) {
            var input = this.$('.lists .add'),
                button = $(event.target);
            if ( input.css('display') === 'none' ) {
                // New list
                input.slideDown( 300, function() { this.focus() } );
                button.html( 'Cancel' );
                this.$el.find('.listlist li').removeClass('active');
            } else {
                // Cancel
                input.slideUp( 300 ).blur();
                button.html( 'New list' );
                this.$el.find('.listlist li').first().addClass('active');
            }
        },

        doDeleteList: function( event ) {
            alert('doDelete');
        },

        doEdit: function( event ) {
            alert('doEdit');
            this.$('.active .title').hide();
            this.$('.active .edit').show().focus();
        },

        events: {
            'click .listlist li': 'doActivate',
            'keyup .lists .add': 'doKeypressAdd',
            'click .lists .toggle-add': 'toggleAddList',
            'click .lists .delete': 'doDeleteList',
            'click .lists .edit': 'doEdit'
        }
    });

    var clientId = '838930909455';
    var apiKey = 'AIzaSyBKGk8Hfl1iodmBdVObtwJlv3tVOuzRT3Y';

    var scopes = 'https://www.googleapis.com/auth/tasks';

    var requests = 0,
        complete = 0;

    var handleClientLoad = function () {
        gapi.client.setApiKey(apiKey);
        window.setTimeout(checkAuth,1);
    };

    var checkAuth = function () {
        gapi.auth.authorize({client_id: clientId, scope: scopes, immediate: true}, handleAuthResult);
    };


    var handleAuthResult = function (authResult) {
        var authorizeButton = $('.btn-auth');
        if (authResult && !authResult.error) {
            $('.login-overlay').fadeOut();
            initAPI();
        } else {
            $('.login-overlay').fadeIn();
            authorizeButton.click(handleAuthClick);
        }
    };

    function handleAuthClick(event) {
        gapi.auth.authorize({client_id: clientId, scope: scopes, immediate: false}, handleAuthResult);
        return false;
    }

    function refresh() {
        tlview = new TaskListView( { el: $('#tasks') });
        listList = new ListList([]);
        app = new AppView( {
            collection: listList,
            el: $('body')
        });
    }

    $('.open-lists').on('click', function( event ) {
        $lists = $('#lists');
        $tasks = $('#tasks');
        if ( $lists.css('display') == "none" ) {
            $lists.show();
            $tasks.css( 'left', '281px' );
        } else {
            $lists.hide();
            $tasks.css( 'left', '0px' );
        }
        
    });

    // Initialize the Tasks API
    function initAPI() {
        gapi.client.load('tasks', 'v1', refresh);
    }

    handleClientLoad();
};