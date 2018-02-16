function readClipboard() {
    var result = '';
    var clipboard = document.getElementById('clipboard');
    clipboard.value = '';
    clipboard.select();
    if (document.execCommand('paste')) {
        result = clipboard.value;
        console.log('got value from clipboard: ' + result);
    }
    clipboard.value = '';
    return result;
}