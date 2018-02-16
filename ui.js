HSDB = null
codes = []
order2dbfId = []
dbfId2order = {}

function message(msg) {
    console.log(msg)
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

function diff() {

    // prepare DOM
    $('.column.deck').remove()
    var placeholder = $('.placeholder')

    // convert codes to decks
    var decks = []
    codes.forEach(function(code, index) {
        var el = $('<div class="column deck"></div>')
        el.insertBefore(placeholder)
        el.append($('<div class="closer" data-index="' + index + '">Close</div>'))

        var rawDeck = deckstrings.decode(code)
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
    var xhr = new XMLHttpRequest()
    xhr.open("GET", "https://api.hearthstonejson.com/v1/latest/enUS/cards.collectible.json", true)
    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4) {
        HSDB = {}
        var resp = JSON.parse(xhr.responseText)
        resp.forEach(function(card) {
            HSDB[card.dbfId] = card
            order2dbfId.push(card.dbfId)
        })

        order2dbfId.sort(function(aID, bID) {
            a = HSDB[aID]
            b = HSDB[bID]

            if (a.cost !== b.cost) return a.cost - b.cost

            if (a.name < b.name) return -1
            else if (a.name > b.name) return 1

            if (a.name == "Valeera the Hollow" || a.name == "N'Zoth, the Corruptor") {
                console.log(a)
            }

            return 0
        })

        order2dbfId.forEach(function(dbfId, index) {
            dbfId2order[dbfId] = index;
        })


        // temp
        codes.push("AAECAaIHBIbCAs/hAtvjAsPqAg3EAZwC7QKfA4gF1AXjBfgHhgn4vQKXwQL8wQLH0wIA")
        diff()

      }
    }
    xhr.send()

    // clicking the placeholder adds decks
    $('.placeholder').on('click', function() {
        var code = chrome.extension.getBackgroundPage().readClipboard()
        if (code) {
            try {
                deckstrings.decode(code) // validity check only
                codes.push(code)
                if (HSDB) {
                    diff()
                }
            } catch(ex) {
                message("You have something other than a deck code on the clipboard...")
                console.log(ex)
            }
        } else {
            message("Please copy a deck code to the clipboard first!")
        }
    })

    // close buttons
    $(document).on('click', '.closer', function() {
        var index = $(this).data('index')
        codes.splice(index, 1)
        diff()
    })

})