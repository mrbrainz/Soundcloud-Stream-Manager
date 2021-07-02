/*********************
Saves options to chrome.storage
*********************/

// jshint strict: false 
// jshint undef: false 
// jshint expr: true 

var values = ['x'],
  checked = ['x'];

function save_options() {

  var options = {};

  for (var i = 0; i<values.length;i++) {
    console.log(document.getElementById(values[i]).value);
    options[values[i]] = document.getElementById(values[i]).value;
  }

  for (i = 0; i<checked.length;i++) {
    options[checked[i]] = document.getElementById(checked[i]).checked;
  }

  chrome.storage.sync.set(options, function() {
    // Update status to let user know options were saved.
    var statusClasses = document.getElementById('alert').classList;

    statusClasses.remove("d-none");

    setTimeout(function() {
      statusClasses.add('d-none');
    }, 1500);
    return false;
  });
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restore_options() {
  // Use default value color = 'red' and likesColor = true.

  var options = {};

  for (var i = 0; i<values.length;i++) {
    options[values[i]] = "";
  }

  for (i = 0; i<checked.length;i++) {
    options[checked[i]] = true;
  }

  chrome.storage.sync.get(options, function(items) {

    for (var i = 0; i<values.length;i++) {
      document.getElementById(values[i]).value = items[values[i]];
    }

    for (i = 0; i<checked.length;i++) {
      document.getElementById(checked[i]).checked = items[checked[i]];
    }


  });
}


// Acivate save buttons

document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', function(event) {
  event.preventDefault();
  save_options();
});

document.getElementById('save2').addEventListener('click', function(event) {
  event.preventDefault();
  save_options();
});





var acc = document.getElementsByClassName("accordion");
var i;

function toggleAccordian(el) {
  el.classList.toggle("active");
    var panel = el.nextElementSibling;
    if (panel.style.maxHeight) {
      panel.style.maxHeight = null;
    } else {
      panel.style.maxHeight = panel.scrollHeight + "px";
    }
}

for (i = 0; i < acc.length; i++) {
  acc[i].addEventListener("click", function() {
    var activeels = document.getElementsByClassName("active");
    for (j=0; j < activeels.length; j++) {
      if (activeels[j] === this) {
        continue;
      }
      toggleAccordian(activeels[j]);
    }
    toggleAccordian(this);
  });
}
