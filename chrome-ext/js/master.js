/*********************
 Master JS - injects 
 template code and runs
 action menu where you
 at
*********************/

// jshint strict: false 
// jshint undef: false 
// jshint expr: true 

// Enables action popup
chrome.runtime.sendMessage({"message": "activate_icon"});

function fetchResource(input, func, args) {
    if (typeof (args) == "undefined") {
        args = null;
    }
    var init = { method: 'GET',
        mode: 'cors',
        cache: 'no-cache',
        credentials: "same-origin",
        redirect: 'follow', 
        referrer: 'no-referrer'};
    return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({type:"fetch",content:{input, init}}, messageResponse => {
      const [response, error] = messageResponse;
      if (response === null) {
        reject(error);
      } else {
        func(response, args);
      }
    });
  });
}