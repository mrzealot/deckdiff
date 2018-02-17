HSDB = null
codes = []
order2dbfId = []
dbfId2order = {}

function message(msg) {
    swal(msg)
}

function save() {
    chrome.storage.sync.set({'codes': codes})
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

function addDeck(code) {
    if (!code) {
        code = chrome.extension.getBackgroundPage().readClipboard()
    }
    if (code) {
        try {
            deckstrings.decode(code) // validity check only
            codes.push(code)
            save()
            diff()
        } catch(ex) {
            message("You have something other than a deck code on the clipboard...")
            console.log(ex)
        }
    } else {
        message("Please copy a deck code to the clipboard first!")
    }
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

        // clicking the placeholder now adds decks
        $('.placeholder').addClass('active').on('click', function(){
            addDeck()
        })

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
        window.open('http://github.com/mrzealot/deckdiff/issues', '_blank')
    })

    $('#info').on('click', function() {
        message('Info...')
    })
})