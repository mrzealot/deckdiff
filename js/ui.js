HSDB = null
codes = []
order2dbfId = []
dbfId2order = {}
version = 'v0.0.0'

var deckcodeRegex = new RegExp('(?:[A-Za-z0-9+/]{4}){10,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{4})', 'g')

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

function ask(title, question, cb) {
    swal(title, question, {
       content: "input",
    })
    .then((value) => {
        cb(value);
    });
}

function save() {
    chrome.storage.sync.set({'codes': codes})
}

function cleanup(code) {
    var match = code.match(deckcodeRegex)
    return match && match[0]
}

function outputCard(deck, match) {
    var order = deck.deck[deck.cardIndex][0]
    var num = deck.deck[deck.cardIndex][1]
    var dbfId = order2dbfId[order]
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
    deck.element.append(cardEl)
}

function outputEmpty(deck) {
    deck.element.append($('<div class="card empty"></div>'))
}

function addCode(code) {
    try {
        code = cleanup(code) // remove possible comments
        deckstrings.decode(code) // validity check only
        codes.push(code)
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
                deckstrings.decode(candidate);
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
    var klass = _.capitalize(HSDB[rawDeck.heroes[0]].playerClass)
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
        var rawDeck = deckstrings.decode(code)
        var info = deckInfo(rawDeck)

        var el = $('<div class="column deck"></div>')
        var header = $(`<div class="header" data-index="${index}"></div>`)
        header.append($(`<span class="format"><span title="${info.format}">${info.formatAbbr}</span><i class="fas fa-angle-right"></i><span>${info.klass}</span></span>`))
        header.append($(`<span class="dust">${info.dust}<i class="fas fa-flask" title="Dust"></i></span>`))
        header.append($('<span class="closer" title="Close this deck!"><i class="fas fa-times"></i></span>'))
        header.append($('<div class="copy-message">Deck copied to clipboard...</div>'))
        header.append($('<span class="copy" title="Copy deckcode to clipboard!"><span><i class="far fa-copy"></i></span></span>'))
        el.append(header)
        el.insertBefore(placeholder)

        var mappedDeck = _.map(rawDeck.cards, function(card) {
            return [dbfId2order[card[0]], card[1]]
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
            arr.push(deck.deck[deck.cardIndex] ? deck.deck[deck.cardIndex][0] : undefined);
            return arr;
        }, [])

        // decks with the minimal candidate
        var mins = current.reduce(function(data, val, index) {
            if (val === undefined) return data;
            if (val < data.min) {
                data.min = val
                data.losers = data.losers.concat(data.winners)
                data.winners = [index]
            } else if (val === data.min) {
                data.winners.push(index)
            } else {
                data.losers.push(index)
            }
            return data;
        }, {
            min: Infinity,
            winners: [],
            losers: []
        })

        // stop if there's nothing left
        if (mins.winners.length === 0) break;

        // otherwise check if the counts match too
        var counts = mins.winners.map(function(index) {
            return decks[index].deck[decks[index].cardIndex][1]
        })
        var match = mins.winners.length === decks.length && _.uniq(counts).length === 1;

        // then write output and start again
        mins.winners.forEach(function(index) {
            outputCard(decks[index], match);
            decks[index].cardIndex++;
        })
        mins.losers.forEach(function(index) {
            outputEmpty(decks[index]);
        })
    }
}

$(function(){

    // load HS JSON and card order
    $.getJSON( 'https://api.hearthstonejson.com/v1/latest/enUS/cards.collectible.json', function(data) {
        HSDB = {}
        data.forEach(function(card) {
            HSDB[card.dbfId] = card
            order2dbfId.push(card.dbfId)
        })

        order2dbfId.sort(function(aID, bID) {
            a = HSDB[aID]
            b = HSDB[bID]
            if (a.cost !== b.cost) return a.cost - b.cost
            if (a.name < b.name) return -1
            else if (a.name > b.name) return 1
            return 0
        })

        order2dbfId.forEach(function(dbfId, index) {
            dbfId2order[dbfId] = index;
        })

        // clicking the placeholder buttons now adds decks
        $('.placeholder').addClass('active')
        $('#paste').on('click', function(){ addDeckFromClipboard() })
        $('#scrape').on('click', function(){ addDeckFromPage() })
        $('#enter').on('click', function(){ addDeckManually() })

        // load the decks from last time 
        chrome.storage.sync.get('codes', function(data) {
            codes = data.codes || []
            diff()
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
        var result = chrome.extension.getBackgroundPage().writeClipboard(codes[index])
        if (result) {
            $(this).parent().children('.copy-message').fadeIn(100).delay(1000).fadeOut(500)
        }
    })

    // header buttons
    $('#clear').on('click', function() {
        codes = []
        save()
        diff()
    })

    $('#issues').on('click', function() {
        chrome.tabs.create({'url': 'http://github.com/mrzealot/deckdiff/issues'})
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