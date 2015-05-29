# Soundcloud Track Killer by Mr Brainz (http://djbrainz.com)

Make your SoundCloud stream usable with this simple Bookmarklet.


Does your browser slow to a crawl when scrolling through
your Soundcloud stream? Mine did. So I wrote this script.

Running this script from a Bookmarket allows you to prune your 
stream as you're looking at it. The top button removes all tracks 
above the one you are currently listening to, or if you're not 
playing one, then it removes all tracks above the one you 
currently have on screen. With less tracks on your screen, 
your browser starts to work again.

There are 2 other buttons that allow you remove reposts from your
stream, or remove non-reposts (direct uploads). When listening
to SC, I give less attention to Reposts, as I'm mainly interested
in the artists I follow. So these buttons let me have 2 runs 
through my stream at different concentration levels.

Magic.


Note - you may have security issues if you don't host the script
somewhere with SSL.

I have a hosted version here: https://secure.slicknfresh.co.uk/nssc/kill-tracks.js

(Last updated: 02/05/2015, no guarantee of uptime or functionality)


Example Bookmarklet:
```
javascript:(function()%7Bvar rnd %3D Math.floor(Math.random()*9999999999)%3Bscrape%3Ddocument.createElement(%27SCRIPT%27)%3Bscrape.type%3D%27text/javascript%27%3Bscrape.id%3D%27nssc-script%27%3Bscrape.src%3D%27https://secure.slicknfresh.co.uk/nssc/kill-tracks.js%3F%27%2Brnd%3Bvar nsscs%3Ddocument.getElementById(%27nssc-script%27)%3Bif (nsscs %3D%3D null)%7Bdocument.getElementsByTagName(%27head%27)%5B0%5D.appendChild(scrape)%3B%3B%7D%7D)()%3B
```

