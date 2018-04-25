// Initialize Firebase
var config = {
  apiKey: "**REMOVED**",
  authDomain: "story-lighting.firebaseapp.com",
  databaseURL: "https://story-lighting.firebaseio.com",
  projectId: "story-lighting",
  storageBucket: "story-lighting.appspot.com",
  messagingSenderId: "**REMOVED**"
};
firebase.initializeApp(config);
var db = firebase.firestore();

chrome.runtime.onInstalled.addListener(function() {
  // Add Some Rules for Activating Browser Action
  chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
    chrome.declarativeContent.onPageChanged.addRules([{
      conditions: [new chrome.declarativeContent.PageStateMatcher({
        pageUrl: {hostEquals: 'www.theguardian.com'}, // String Equality
      })
      ],
          actions: [new chrome.declarativeContent.ShowPageAction()] // Show Action
    }]);
  });

  // Browser Action Clicked
  chrome.pageAction.onClicked.addListener(function (){
    chrome.tabs.executeScript({file: 'contentSniffer.js'});
    chrome.tabs.insertCSS({file: 'contentColorIndicator.css'});
  });
});

// Color Message Send
chrome.runtime.onMessage.addListener( function(message, sender, sendResponse) {
    console.log(sender.tab ? "from a content script:" + sender.tab.url : "from the extension");

    // Update Server Request
    if (message.type == "colorUpdate"){
      console.log(message.color);
      sendResponse({recieved: true});
    }

    if (message.type == "sendArticleContent"){

      // Create URL Hash
      let articleID = new Hashes.SHA1().hex(message.url);
      let _date = chrono.parseDate(message.date);

      db.collection("articles").doc(articleID).set({
        id: articleID,
        title: message.title,
        author: message.author,
        date: _date,
        url: message.url,
        paragraphs: message.paragraphs
      })
      .then(function() {
        sendResponse({recieved: true});
      })
      .catch(function(error) {
        sendResponse({recieved: false, error: error});
      });
    }
});
