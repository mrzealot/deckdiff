HSDB = null
codes = []
order2dbfId = []
dbfId2order = {}

var deckcodeRegex = new RegExp('(?:[A-Za-z0-9+/]{4}){10,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{4})', 'g')

function message(msg) {
    swal(msg)
}

function ask(question, cb) {
    swal(question, {
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
    cardEl.append($('<span class="mana">&#x2B23;</span>'))
    cardEl.append($('<span class="cost">' + card.cost + '</span>'))
    cardEl.append($('<span class="name">' + card.name + '</span>'))
    if (rarity === 'legendary') {
        cardEl.append($('<span class="num star">&starf;</span>'))
    } else {
        cardEl.append($('<span class="num">' + num + '</span>'))
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
        message('Mistakes were made... (This is not a valid deckcode)')
        console.log(ex)
    }
}

function addDeckFromClipboard() {
    code = chrome.extension.getBackgroundPage().readClipboard()
    if (code) {
        addCode(code)
    } else {
        message('Please copy a deckcode to the clipboard first!')
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
            message("Sorry, I couldn't find anything deckcode-ish...")
        }
    })
}

function addDeckManually() {
    ask('Please enter a deckcode:', addCode)
}

function deckInfo(rawDeck) {
    var klass = _.capitalize(HSDB[rawDeck.heroes[0]].playerClass)
    var format = rawDeck.format === 1 ? 'Wild' : 'Standard'
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
        var header = $('<div class="header" data-index="' + index + '"></div>')
        header.append($('<span class="format">' + info.format + '</span>'))
        header.append($('<span class="klass">' + info.klass + '</span>'))
        header.append($('<span class="dust">' + info.dust + '<i class="fas fa-flask"></i></span>'))
        header.append($('<span class="closer"><i class="fas fa-times"></i></span>'))
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

    // close buttons
    $(document).on('click', '.closer', function() {
        var index = $(this).parent().data('index')
        codes.splice(index, 1)
        save()
        diff()
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
        message('This extension helps you compare different versions of Hearthstone decks.\n' +
            'Just copy a deckcode to your clipboard and press the huge plus sign to add a deck...')
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