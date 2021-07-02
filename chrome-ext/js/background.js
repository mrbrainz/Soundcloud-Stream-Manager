// jshint strict: false 
// jshint undef: false 
// jshint expr: true 
// jshint latedef: false


chrome.runtime.onInstalled.addListener(function() {    // add an action here
    
});


// Async fetch the Chrome Plugin way

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  switch(request.type)  {
    case "fetch":
         fetch(request.content.input, request.content.init).then(function(response) {
        return response.text().then(function(text) {
          sendResponse([{
            body: text,
            status: response.status,
            statusText: response.statusText,
          }, null]);
        });
      }, function(error) {
        sendResponse([null, error]);
      });
    return true;

    case "fetchimg":
         fetch(request.content.input, request.content.init).then(function(response) {
        return response.blob().then(function(blob) {
          sendResponse([{
            body: blob,
            status: response.status,
            statusText: response.statusText,
          }, null]);
        });
      }, function(error) {
        sendResponse([null, error]);
      });
        return true;
    
    }
    
    return true;
});



//background.js
chrome.extension.onMessage.addListener(
    function(request, sender, sendResponse) {
    if (request.message === "activate_icon") {
        chrome.pageAction.show(sender.tab.id);
    }
});


chrome.tabs.onUpdated.addListener(function(id, info, tab){
    showPageAction(tab);
});

chrome.tabs.onActivated.addListener(function(id, info, tab){
    setTimeout(function() {
        chrome.tabs.query({ currentWindow: true, active: true },
            function (tabArray) {
                if(tabArray[0]){
                    showPageAction(tabArray[0]);
                }
            });
    },100);
});

function showPageAction(tab){
    chrome.pageAction.show(tab.id);
}