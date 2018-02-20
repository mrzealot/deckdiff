function readClipboard() {
    var result = '';
    var clipboard = document.getElementById('clipboard');
    clipboard.value = '';
    clipboard.select();
    if (document.execCommand('paste')) {
        result = clipboard.value;
    }
    clipboard.value = '';
    return result;
}

function writeClipboard(content) {
    var clipboard = document.getElementById('clipboard');
    clipboard.value = content;
    clipboard.select();
    return document.execCommand('copy')
}