function voodoo( $, window, gapi, _, Backbone ) {

    /* Terminology:
        "update":  save client-side changes to server
        "refresh": pull data form server
    */

    /*
        Models
    */

    var Task = Backbone.Model.extend({
        defaults: {
            id: null,
            title: '',
            status: 'needsAction'
        },
        initialize: function(){
            //alert("Welcome to this world");
            this.on( 'change:title', function( model ) {
                var name = model.get("name"); // 'Stewie Griffin'
            }).on( 'change:status', function( model ) {
                this.update();
            } );
        },
        update: function() {
            // update per API
        },
        refresh: function() {
            // refresh per API
        }
    });

    var List = Backbone.Model.extend({
        defaults: {
            id: null,
            title: 'Untitled list',
            tasklist: null // TaskList collection
        },
        initialize: function() {
            //alert("Welcome to this world");
            this.on( 'change:title', function( model ) {
                var name = model.get("name"); // 'Stewie Griffin'
            });
        },
        update: function() {
            // update per API
        },
        refresh: function() {
            // refresh per API
        }
    });

    /*
        Collections
    */

    var TaskList = Backbone.Collection.extend({
        model: Task
    });

    var ListList = Backbone.Collection.extend({
        model: List
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
            this.$el.html( this.template( this.model.toJSON() ) );
            this.$el.toggleClass( 'completed', this.model.get('completed') );

            this.input = this.$('.edit');
            return this;
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
            $('.not-authorized').hide();
            $('.authorized').show();
            $('.lists').addClass('open');
            initAPI();
        } else {
            $('.not-authorized').show();
            $('.authorized').hide();
            authorizeButton.click(handleAuthClick);
        }
    };

    var showBanner = function( message ) {
        console.log( message );
        $('.banner p').text( message ).fadeIn();
    };

    var createList = function( title ) {
        // UI
        console.log( 'Creating list ' + title );
        var li = $('<li>').text(title).appendTo('.lists ul');
        addListToList( res );

        // API
        requests += 1;
        var req = gapi.client.tasks.tasklists.insert({
            resource: { title: title }
        });
        req.execute(function( res ) {
            // Success? Failure?
            li.attr('data-id', list.id);
        });
    };

    var addListToList = function( list ) {
        var li = $('<li>').attr('data-id', list.id).text(list.title).appendTo('.lists ul');
        //li[top === true ? 'prependTo' : 'appendTo']('.tasks ul[data-id="' + list + '"]');
    }

    var purge = function( listid ) {
        console.log( 'Clearing list ' + listid );
        var req = gapi.client.tasks.tasks.clear({
            tasklist: listid
        });
        req.execute(function( res ) {
            // refresh tasks
        });
    }

    var deleteList = function( listid ) {
        console.log( 'Deleting list ' + listid );
        var req = gapi.client.tasks.tasklists.delete({
            tasklist: listid
        });
        req.execute(function( res ) {
            // refresh lists
        });
    }

    var renameList = function( listid, title ) {
        console.log( 'Updating list ' + listid );
        var req = gapi.client.tasks.tasklists.update({
            tasklist: listid,
            resource: {
                title: title,
                id: listid
            }
        });
        req.execute( function( res ) {
            //refreshTask( res );
            // refresh list of lists
        });
    }

    var deleteTask = function( listid, taskid ) {
        console.log( 'Deleting task ' + taskid );
        var req = gapi.client.tasks.tasks.delete({
            tasklist: listid,
            task: taskid
        });
        req.execute(function( res ) {
            // refresh tasks
        });
    }

    var addTask = function( title ) {
        var list = $('.lists li.active').attr('data-id');
        var req = gapi.client.tasks.tasks.insert({
            tasklist: list,
            resource: { title: title }
        });
        req.execute(function( res ) {
            addTaskToList( list, res, true );
        });
    };

    var addTaskToList = function( list, task, top ) {
        var li = $('<li>').attr('data-id', task.id).attr('data-status', task.status);
        $('<i>').addClass('icon-sort').appendTo( li );
        $('<i>').addClass('check icon-check' + (task.status === 'completed' ? '' : '-empty')).appendTo( li );
        $('<span>').addClass('title').text(task.title).appendTo( li );
        $('<i>').addClass('icon-trash delete').appendTo( li );
        li[top === true ? 'prependTo' : 'appendTo']('.tasks ul[data-id="' + list + '"]');
    }

    var refreshTask = function( task ) {
        var el = $('.tasks li[data-id="' + task.id + '"]');
        el.attr( 'data-status', task.status );
        if ( task.status === "completed" ) {
            el.find('i.check').addClass('icon-check').removeClass('icon-check-empty');
        } else {
            el.find('i.check').addClass('icon-check-empty').removeClass('icon-check');
        }
        $(el).find('span.title').text( task.title );
    }

    var updateTask = function( listid, task ) {
        console.log( 'Updating task ' + task.id );
        var req = gapi.client.tasks.tasks.update({
            tasklist: listid,
            task: task.id,
            resource: task
        });
        req.execute( function( res ) {
            refreshTask( res );
        });
    }

    var moveTask = function( listid, taskid, previd ) {
        console.log( 'Moving task ' + taskid );
        var req = gapi.client.tasks.tasks.move({
            tasklist: listid,
            task: taskid,
            previous: previd
        });
        req.execute( function( res ) {
            //refreshTask( res );
        });
    }

    function handleAuthClick(event) {
        gapi.auth.authorize({client_id: clientId, scope: scopes, immediate: false}, handleAuthResult);
        return false;
    }

    function refresh() {
        var request = gapi.client.tasks.tasklists.list();
        request.execute(function(resp) {
            resp.items.forEach(function(item, i) {

                var heading = $('<li>').text(item.title).attr('data-id', item.id);
                heading.appendTo('.lists ul');
                var request = gapi.client.tasks.tasks.list({
                    tasklist: item.id
                });
                request.execute(function(resp) {
                    var ul = $('<ul>').attr('data-id', item.id).hide().appendTo('.tasks');
                    ul.sortable({
                        handle: '.icon-sort',
                        axis: 'y',
                        distance: 5,
                        placeholder: 'placeholder',
                        receive: function(event, ui) {
                            console.log ("move");
                            var prev = $(this).prev();
                            moveTask(
                                $('.lists ul.active').attr('data-id'),
                                $(this).attr('data-id'),
                                prev.length > 0 ? prev.attr('data-id') : ''
                            );
                        }
                    });
                    var ulid = item.id;
                    if(i == 0) { heading.trigger('click'); }
                    if ( resp.items ) {
                        resp.items.forEach(function(item, id) {
                            addTaskToList( ulid, item );
                        });
                    }
                });
            });
        });
    }

    // Initialize the Tasks API
    function initAPI() {
        gapi.client.load('tasks', 'v1', refresh);
    }

    var resize = function() {
        $('.tasks, .lists').height(
            $(window).height() - $('header').outerHeight() - $('footer').outerHeight()
        );
        $(document).height( $(window).height() );
    };

    handleClientLoad();

    $(function () {
        $(window).resize( resize );
        //handleClientLoad();
        resize();
    });

    /***
     * Event Handlers
     ***/

     /*** List interactions ***/

    // Choose task list
    $('.lists li').live('click', function (event) {
        $('.tasks ul').hide();
        $('.tasks ul[data-id="' + $(this).attr('data-id') + '"]').show();
        $('.lists li').removeClass('active');
        $(this).addClass('active');
        var sum = $('.tasks ul[data-id="' + $(this).attr('data-id') + '"] li').length;
        var completed = $('.tasks ul[data-id="' + $(this).attr('data-id') + '"] li[data-status="completed"]').length;
        var msg =
            (sum === completed) && (sum !== 0)
            ? 'Tasks <em>All completed. Congratulations!</em>'
            : 'Tasks <em>' + completed + ' of ' + sum + ' completed.</em>';
        $('.tasks h2').html( msg );
    });

    // Click "Add List" button
    $('footer .btn-add').click(function() {
        $(this).hide();
        $('.lists input.new-list').show().focus();
    });

    // Add list
    $('.lists input.new-list').live('keypress', function (event) {
        if ( event.which == 13 ) {
            event.preventDefault();
            addList( $(this).val() );
            $(this).hide().val('');
            $('.lists .btn-add').show();
        }
    });

    // Purge
    $('.purge').click(function (event) {
        event.preventDefault();
        purge( $('.lists li.active').attr('data-id') );
    });

    // Delete list
    $('footer .btn-delete').click(function (event) {
        event.preventDefault();
        deleteList( $('.lists li.active').attr('data-id') );
    });

    // Rename list
    $('footer .btn-edit').click(function (event) {
        event.preventDefault();
        var li = $('.lists li.active');
        var input = $('<input type="text">').val( li.text() );
        li.html( input );
        input.focus();
    });

    $('.lists li input').live('keypress', function (event) {
        if ( event.which == 13 ) {
            event.preventDefault();
            var text = $(this).val();
            renameList( $(this).parents('li:first').attr('data-id'), text);
            $(this).parents('li:first').text( text );
        }
    });

    /*** Task interactions ***/

    // Add task
    $('.tasks input.new-task').live('keypress', function (event) {
        if ( event.which == 13 ) {
            event.preventDefault();
            addTask( $(this).val() );
            $(this).val('');
        }
    });

    // Toggle task completeness
    $('.tasks li .check').live('click', function (event) {
        var li = $(this).parents('li:first');
        updateTask( $('.lists li.active').attr('data-id'), {
            status: li.attr('data-status') == "completed" ? "needsAction" : "completed",
            id: li.attr('data-id')
        });
    });

    // Click on task title to change it
    $('.tasks li .title').live( 'click', function (event) {
        event.preventDefault();
        var input = $('<input type="text">').val( $(this).text() );
        $(this).replaceWith( input );
        input.focus();
    });

    // Change task title
    $('.tasks li input').live('keypress', function (event) {
        if ( event.which == 13 ) {
            event.preventDefault();
            var span = $('<span class="title">').text( $(this).val() );
            updateTask( $('.lists li.active').attr('data-id'), {
                title: $(this).val(),
                id: $(this).parents('li:first').attr('data-id')
            });
            $(this).replaceWith( span );
        }
    });

    // Direct task interaction
    $('.tasks li .delete').live( 'click', function (event) {
        event.preventDefault();
        deleteTask( $('.lists li.active').attr('data-id'), $(this).parents('li:first').attr('data-id') );
    });
};