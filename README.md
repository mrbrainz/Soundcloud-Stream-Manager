# Soundcloud Stream Manager by Mr Brainz (http://djbrainz.com)

Make your SoundCloud stream usable with this simple Bookmarklet.

Get it here: http://mrbrainz.github.io/Soundcloud-Stream-Manager


Does your browser slow to a crawl when scrolling through
your Soundcloud stream? Mine did. So I wrote this script.

This bookmarklet enables you to do some cool things, like:

* Remove Reposts from your stream
* Remove tracks over a certain age (for pruning Repost Masturbators)
* Remove tracks over a certain length for hiding mixes
* Remove tracks before the one your looking at or listening to,
  to help with browser performace

Magic.


Note - If you self-host, you may have security issues if you don't 
host the script somewhere with SSL.

Example Bookmarklet:

```
javascript:(function()%7Bvar rnd %3D Math.floor(Math.random()*9999999999)%3Bscrape%3Ddocument.createElement(%27SCRIPT%27)%3Bscrape.type%3D%27text/javascript%27%3Bscrape.id%3D%27nssc-script%27%3Bscrape.src%3D%27https://mrbrainz.github.io/Soundcloud-Stream-Manager/src/scsm-min.js%3F%27%2Brnd%3Bvar nsscs%3Ddocument.getElementById(%27nssc-script%27)%3Bif (nsscs %3D%3D null)%7Bdocument.getElementsByTagName(%27head%27)%5B0%5D.appendChild(scrape)%3B%3B%7D%7D)()%3B
```

