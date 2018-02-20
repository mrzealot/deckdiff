# DeckDIFF

Chrome plugin for diffing Hearthstone decks.

Adding decks is done using the official deckcode (a.k.a. deckstring) format.
You can add decks:

- directly from the clipboard using the topmost "clipboard" icon,
- by parsing the source code of the currently open page using the middle "code" icon, or
- typing in the deckcode manually using the bottom "keyboard" icon.

Deckcodes are recognized as valid base64 strings that successfully validate with the excellent [npm-deckstrings](https://github.com/HearthSim/npm-deckstrings) library.
Card information comes from the [HearthstoneJSON API](https://api.hearthstonejson.com/v1/latest/enUS/cards.collectible.json).

Once decks are loaded, cards are displayed in cost/name order side-by-side and the differences are highlighted.
The plugin remembers your decks but you can manually remove them either one at a time (using the X icon in the top right corner of the deck's header) or all at once (using the clear button in the top right corner of the whole plugin window).
The other "header icons" (continuing from right to left) are:

- flag: bring you to this repo's issue page,
- lightbulb: show this readme, and
- maximize: open the plugin in a separate new tab for more screen real estate.

Feature ideas and pull requests are welcome.
