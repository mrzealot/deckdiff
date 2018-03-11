# DeckDIFF

Chrome and Firefox plugin for diffing Hearthstone decks.

## Install

### Chrome

- download **and extract** the latest release .zip file
- navigate to `chrome://extensions`
- click "Load unpacked extension" and select the extracted folder

### Firefox

For now, the extension is not signed by Mozilla, so the only 2 options for using it are temporary installs or using the Developer version of Firefox.

#### Temporary install

- download **and extract** the latest release .zip file
- navigate to `about:debugging`
- click "Load Temporary Add-on" and select **any** file from within the extracted folder

This installation will only last until the next restart.

#### Firefox Developer Edition

If you have the Developer Edition of Firefox, you can:

- download the latest release .zip file
- **without extracting it**, rename its extension from .zip to .xpi
- navigate to `about:config` (and "accept the risk")
- set `xpinstall.signatures.required` to false
- navigate to `about:addons` 
- on the Extensions tab click "Install Add-on From File" under the cog icon dropdown select the .xpi

## Usage

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

- cog: bring up the options page (see below),
- lightbulb: show this readme, and
- maximize: open the plugin in a separate new tab for more screen real estate.

## Options

### Matching cards

For matching cards, you can set the comparison behaviour to one of three options:

- Display the cards **inline**, just like the differences (only affected by the transparency) [default]
- Display the cards **separate**ly at the top
- Matching cards should be **hidden** altogether

Additionally, you can set how transparent the matches should look with the **Transparency** slider.
(Higher values mean greater transparency, so you'll see it less)

### Differing cards

As for the differences, you can set how the layout should work:

- The **expanded** layout inserts empty spaces between cards to correctly line up the same cards on the same row [default], while
- The **collapsed** layout omits these spaces for a more compact view.

## Issues

- the clipboard access doesn't work in Firefox yet, so FF users need to use the other 2 methods of adding decks for now.
- the extension uses the WebExtensions API, so it should also be compatible with Opera, but I haven't tested it yet.

Feature ideas and pull requests are welcome.
