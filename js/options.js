$(function(){

    //
    // radio clicks
    //

    $('label.btn').on('click', function() {
        var that = $(this)
        if (!that.hasClass('active')) {
            var label = that.children('input')
            var key = label.data('key')
            var value = label.data('value')
            var data = {}
            data[key] = value
            chrome.storage.sync.set(data)
        }
    })

    //
    // radio defaults
    //

    $.getJSON( chrome.extension.getURL('options.json'), function(defaults) {
        chrome.storage.sync.get(defaults, function(data) {
            Object.keys(data).forEach(function(key) {
                var value = data[key]
                try {
                    var el = $('#' + key + '-' + value)
                    if (el.length) {
                        el.parent().button('toggle')
                    }
                } catch (ex) {}
            })
        })
    })

    //
    // slider
    //

    var handle = $('#custom-handle');
    chrome.storage.sync.get({transparency: 50}, function(data) {
        $('#slider').slider({
            value: 100 - data.transparency,
            create: function() {
                handle.text($(this).slider('value') + '%');
            },
            slide: function(event, ui) {
                handle.text(ui.value + '%');
                chrome.storage.sync.set({
                    transparency: 100 - ui.value
                })
            }
        })
    })

    //
    // close
    //

    $('#back').on('click', function() {
        var suffix = (window.location.href.indexOf('maximized') !== -1) ? '?maximized' : ''
        window.location.href = chrome.extension.getURL('ui.html') + suffix
    })
})