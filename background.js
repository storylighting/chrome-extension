chrome.runtime.onInstalled.addListener(function() {
  chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
    chrome.declarativeContent.onPageChanged.addRules([{
      conditions: [new chrome.declarativeContent.PageStateMatcher({
        pageUrl: {hostEquals: 'www.theguardian.com'},
      })
      ],
          actions: [new chrome.declarativeContent.ShowPageAction()]
    }]);
  });
  chrome.pageAction.onClicked.addListener(function (){
    chrome.tabs.executeScript({file: 'contentSniffer.js'});
    chrome.tabs.insertCSS({file: 'contentColorIndicator.css'});
  });
});
chrome.runtime.onMessage.addListener( function(message, sender, sendResponse) {
    console.log(sender.tab ? "from a content script:" + sender.tab.url : "from the extension");

    // Update Server Request
    if (message.type == "colorUpdate"){
      console.log(message.color);
    }

    sendResponse({recieved: true});
});
