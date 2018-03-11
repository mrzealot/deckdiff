HSDB = null
codes = []
order2id = []
version = 'v0.0.0'
options = defaults = {}

var deckcodeRegex = new RegExp('(?:[A-Za-z0-9+/]{4}){10,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{4})', 'g')
var decknameRegex = new RegExp('^### (.*)$', 'm')

function message(title, msg, html) {
    if (html) {
        swal({
            content: $(`
                <div>
                    <div class="swal-title">${title}</div>
                    <div class="swal-text">${msg}</div>
                </div>
            `)[0]
        })
    } else {
        swal(title, msg)
    }
}

function ask(title, question, cb, input) {
    swal(title, question, {
        content: (input && input[0]) || 'input',
        buttons: {
            confirm: {
                value: (input && input.val()) || '',
            }
        }
    })
    .then(function(value) {
        cb(value)
    })
}

function save() {
    chrome.storage.sync.set({'codes': codes})
}

function cleanup(code) {
    var codeMatch = code.match(deckcodeRegex)
    var nameMatch = code.match(decknameRegex)
    return {
        code: codeMatch && codeMatch[0],
        name: nameMatch && nameMatch[1] // first capturing group, so the ###s are already stripped
    }
}

function outputCard(deck, match) {

    if (match && options.match === 'hidden') return

    var order = deck.deck[deck.cardIndex][0]
    var num = deck.deck[deck.cardIndex][1]
    var dbfId = order2id[order]
    var card = HSDB[dbfId]
    var cardEl = $('<div></div>')
    var rarity = card.rarity.toLowerCase()
    cardEl.addClass('card')
    cardEl.addClass(rarity)
    if (match) cardEl.addClass('match')
    cardEl.append($('<div class="cost"><span>' + card.cost + '</span></div>'))
    cardEl.append($('<div class="name">' + card.name + '</div>'))
    if (rarity === 'legendary') {
        cardEl.append($('<div class="num star">&starf;</div>'))
    } else {
        cardEl.append($('<div class="num">' + num + '</div>'))
    }

    var target =
        (match && options.match === 'separate') ?
        deck.element.children('.top') :
        deck.element.children('.bottom')
    target.append(cardEl)
}

function outputEmpty(deck) {
    if (options.diff === 'collapsed') return
    deck.element.children('.bottom').append($('<div class="card empty"></div>'))
}

function addCode(code) {
    try {
        var result = cleanup(code) // parse code (and name), remove possible comments
        deckstrings.decode(result.code) // validity check only
        codes.push({
            code: result.code,
            name: result.name
        })
        save()
        diff()
    } catch(ex) {
        message('Mistakes were made...', 'This is not a valid deckcode!')
        console.log(ex)
    }
}

function addDeckFromClipboard() {
    code = chrome.extension.getBackgroundPage().readClipboard()
    if (code) {
        addCode(code)
    } else {
        message('Mistakes were made...', 'Please copy a deckcode to the clipboard first!')
    }
}

function scraper() {
    var regex = new RegExp('(?:[A-Za-z0-9+/]{4}){10,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{4})', 'g')
    return document.documentElement.outerHTML.match(regex)
}

function addDeckFromPage() {
    var inject = `(${scraper})()`
    chrome.tabs.executeScript({code: inject}, function(candidates) {
        var theOne = candidates && candidates[0] && candidates[0].find(function(candidate) {
            try {
                deckstrings.decode(candidate)
                return true
            } catch (ex) {}
            return false
        })
        if (theOne) {
            addCode(theOne)
        } else {
            message('Sorry about that...', "I couldn't find anything deckcode-ish.")
        }
    })
}

function addDeckManually() {
    ask('Here we go...', 'Please enter a deckcode:', function(value) {
        if (value) {
            addCode(value)
        }
    })
}

function deckInfo(rawDeck) {
    var klass = _.capitalize(HSDB[rawDeck.heroes[0]].cardClass)
    var format = rawDeck.format === 1 ? 'Wild' : 'Standard'
    var formatAbbr = rawDeck.format === 1 ? 'Wld' : 'Std'
    var dust = 0
    var dustTable = {
        COMMON: 40,
        RARE: 100,
        EPIC: 400,
        LEGENDARY: 1600
    }
    rawDeck.cards.forEach(function(card) {
        dust += (dustTable[HSDB[card[0]].rarity] || 0) * card[1]
    })

    return {
        klass: klass,
        format: format,
        formatAbbr: formatAbbr,
        dust: dust
    }
}

function diff() {

    // prepare DOM
    $('.column.deck').remove()
    var placeholder = $('.placeholder')

    if (codes.length === 0) return

    // convert codes to decks
    var decks = []
    codes.forEach(function(code, index) {
        var rawDeck = deckstrings.decode(code.code)
        var info = deckInfo(rawDeck)

        var el = $('<div class="column deck"></div>')
        var header = $(`<div class="header" data-index="${index}"></div>`)
        var deckName = code.name || `Anonym ${info.klass}`
        header.append($(`<span class="deck-name" title="${deckName}">${deckName}</span>`))
        header.append($('<div class="copy-message">Deck copied to clipboard...</div>'))
        header.append($('<span class="copy" title="Copy deckcode to clipboard!"><span><i class="far fa-copy"></i></span></span>'))
        header.append($('<span class="closer" title="Close this deck!"><i class="fas fa-times"></i></span>'))
        el.append(header)

        var subheader = $(`<div class="subheader" data-index="${index}"></div>`)
        subheader.append($(`<span class="format"><span>${info.format}</span><i class="fas fa-angle-right"></i><span>${info.klass}</span></span>`))
        subheader.append($(`<span class="dust">${info.dust}<i class="fas fa-flask" title="Dust"></i></span>`))
        el.append(subheader)

        el.append($('<div class="top"></div>'))
        el.append($('<div class="bottom"></div>'))

        el.insertBefore(placeholder)

        var mappedDeck = _.map(rawDeck.cards, function(card) {
            return [order2id.indexOf(card[0]), card[1]]
        })
        var sortedDeck = _.sortBy(mappedDeck, function(card) {
            return card[0]
        })

        decks.push({
            deck: sortedDeck,
            element: el,
            cardIndex: 0
        })
    })

    // start the sweep
    while (true) {

        // row candidates
        var current = decks.reduce(function(arr, deck) {
            arr.push(deck.deck[deck.cardIndex] ? deck.deck[deck.cardIndex][0] : undefined)
            return arr
        }, [])

        // decks with the minimal candidate
        var mins = current.reduce(function(data, val, index) {
            if (val === undefined) return data
            if (val < data.min) {
                data.min = val
                data.losers = data.losers.concat(data.winners)
                data.winners = [index]
            } else if (val === data.min) {
                data.winners.push(index)
            } else {
                data.losers.push(index)
            }
            return data
        }, {
            min: Infinity,
            winners: [],
            losers: []
        })

        // stop if there's nothing left
        if (mins.winners.length === 0) break

        // otherwise check if the counts match too
        var counts = mins.winners.map(function(index) {
            return decks[index].deck[decks[index].cardIndex][1]
        })
        var match = mins.winners.length === decks.length && _.uniq(counts).length === 1

        // then write output and start again
        mins.winners.forEach(function(index) {
            outputCard(decks[index], match)
            decks[index].cardIndex++
        })
        mins.losers.forEach(function(index) {
            outputEmpty(decks[index])
        })
    }
}

$(function(){

    // load HS JSON and card order
    $.getJSON( 'https://api.hearthstonejson.com/v1/latest/enUS/cards.collectible.json', function(data) {
        HSDB = {}
        data.forEach(function(card) {
            if (card.cost === undefined) { // giving a fictional negative cost to heroes for correct sorting
                card.cost = -1
            }
            HSDB[card.dbfId] = card
            order2id.push(card.dbfId)
        })

        order2id.sort(function(aID, bID) {
            var a = HSDB[aID]
            var b = HSDB[bID]
            if (a.cost !== b.cost) return a.cost - b.cost
            if (a.name < b.name) return -1
            else if (a.name > b.name) return 1
            return 0
        })

        // clicking the placeholder buttons now adds decks
        $('.placeholder').addClass('active')
        $('#paste').on('click', function(){ addDeckFromClipboard() })
        $('#scrape').on('click', function(){ addDeckFromPage() })
        $('#enter').on('click', function(){ addDeckManually() })

        // load options
        $.getJSON( chrome.extension.getURL('options.json'), function(json) {
            defaults = json
            chrome.storage.sync.get(defaults, function(data) {
                options = data
                codes = data.codes

                // set transparency css rule
                $('<style>')
                    .prop('type', 'text/css')
                    .html(`
                        .card.match {
                            opacity: ${options.transparency / 100};
                        }
                    `).appendTo('head')

                diff()
            })
        })
    })

    // load version, just for fun (or debugging)
    $.getJSON( chrome.extension.getURL('manifest.json'), function(data) {
        version = 'v' + data.version
        $('#name').on('click', function() {
            message('The pleasure is mine', `
                <p>DeckDIFF ${version}</p><p>coded with <i class="fas fa-heart"></i> by <a class="credit-link" href="https://github.com/mrzealot" target="_blank">MrZealot</a></p>
            `, true)
        })
    })

    // close buttons
    $(document).on('click', '.closer', function() {
        var index = $(this).parent().data('index')
        codes.splice(index, 1)
        save()
        diff()
    })

    // copy buttons
    $(document).on('click', '.copy', function() {
        var index = $(this).parent().data('index')
        var string = codes[index].code
        if (codes[index].name) {
            string = '### ' + codes[index].name + '\n' + string
        }
        var result = chrome.extension.getBackgroundPage().writeClipboard(string)
        if (result) {
            $(this).parent().children('.copy-message').fadeIn(100).delay(1000).fadeOut(500)
        }
    })

    // deck names
    $(document).on('click', '.deck-name', function() {
        var that = $(this)
        var index = that.parent().data('index')
        var name = codes[index].name || ''

        // custom input that is prepopulated with the current deck name
        $input = $(`<input type="text" value="${name}" />`)
        $input.on('change', function() {
            swal.setActionValue($(this).val())
        })
        ask('So many options...', 'Give this deck a name:', function(value) {
            if (value && value !== codes[index].name) {
                codes[index].name = value
                that.attr('title', value).html(value)
            }
        }, $input)
    })

    // header buttons
    $('#clear').on('click', function() {
        codes = []
        save()
        diff()
    })

    $('#options').on('click', function() {
        var suffix = (window.location.href.indexOf('maximized') !== -1) ? '?maximized' : ''
        window.location.href = chrome.extension.getURL('options.html') + suffix
    })

    $('#info').on('click', function() {
        chrome.tabs.create({'url': 'https://github.com/mrzealot/deckdiff/blob/master/README.md'})
    })

    $('#maximize').on('click', function() {
        chrome.tabs.create({'url': chrome.extension.getURL('ui.html') + '?maximized'})
    })

    // handle stretching if it's opened in a new tab
    if (window.location.href.indexOf('maximized') !== -1) {
        var size = function() {
            return $(window).height() - $('header').outerHeight(true)
        }
        $('#maximize').hide()
        $('#container')
        .css('max-width', 'initial')
        .css('max-height', size())
        $(window).on('resize', function() {
            $('#container').css('max-height', size())
        })
    }
})