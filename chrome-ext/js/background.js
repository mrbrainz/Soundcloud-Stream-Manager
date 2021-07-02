// jshint strict: false 
// jshint undef: false 
// jshint expr: true 


chrome.runtime.onInstalled.addListener(function() {    // add an action here
    
});

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
    
    case "gettemplates":
        chrome.runtime.getPackageDirectoryEntry(function(directoryEntry) {
            directoryEntry.getDirectory('templates', {}, function(subDirectoryEntry) {
                var directoryReader = subDirectoryEntry.createReader();
                // List of DirectoryEntry and/or FileEntry objects.
                
                var filenames = [];
                (function readNext() {
                    directoryReader.readEntries(function(entries) {
                        if (entries.length) {
                            for (var i = 0; i < entries.length; ++i) {
                                filenames.push(entries[i].name);
                            }
                            readNext();
                        } else {
                            // No more entries, so all files in the directory are known.
                            // Do something, e.g. print all file names:
                           //console.log(filenames);
                           sendResponse(filenames);

                        }
                    });
                return true;
                })();
            return true;
            });
        return true;
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
    chrome.tabs.query({ currentWindow: true, active: true },
        function (tabArray) {
            if(tabArray[0]){
                showPageAction(tabArray[0]);
            }
        });
});

function showPageAction(tab){
    chrome.pageAction.show(tab.id)
}