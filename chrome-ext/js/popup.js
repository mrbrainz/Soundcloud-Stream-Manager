/*********************
 JS for action button
 popup
*********************/

// jshint strict: false 
// jshint undef: false 
// jshint expr: true 


function addMenuURLs() {

	var menu = document.getElementById("options").getElementsByClassName("am-page");

	for (var i=0;i>menu.length;i++) {
		menu[i].href = chrome.extension.getURL(menu[i].href);
	}
}



addMenuURLs();