/**
*
*   Hype Panel Unminified Source
*
**/

/* jshint -W083 */
/* jshint multistr: true */

function parseSCDate(tdate) {
    var system_date = new Date(Date.parse(tdate)),
    user_date = new Date(),
    diff = Math.floor((user_date - system_date) / 1000);
    if (diff < 60) {return " secs";}
    if (diff <= 3540) {return Math.round(diff / 60) + " mins";}
    if (diff <= 5400) {return "1 hour ago";}
    if (diff <= 86400) {return Math.round(diff / 3600) + " hours";}
    if (diff <= 2592000) {return Math.round(diff / 86400) + " days";}
    return Math.round(diff / 2592000) + " months";
}

function isElementInViewport(vel) {

    if (typeof jQuery === "function" && vel instanceof jQuery) {
        vel = vel[0];
    }

    var rect = vel.getBoundingClientRect();

    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

function copyNowPlayingToClipboard() {
  var nowPlayingURL = 'https://soundcloud.com'+$(".playControls .playControls__soundBadge .playbackSoundBadge__titleLink").attr("href"),
  inputfield = document.getElementById("ssmctc");

  if (nowPlayingURL.indexOf('?') !== -1) {
    nowPlayingURL = nowPlayingURL.split("?")[0];
  }

  inputfield.value = nowPlayingURL;
  inputfield.style.display = "block";
  inputfield.select();
  inputfield.setSelectionRange(0, 99999);
  document.execCommand("copy");
  inputfield.style.display = "none";
  inputfield.value = "";
}

function searchOnDeezer() {
    var nowPlayingEl = document.getElementsByClassName("playbackSoundBadge__titleContextContainer")[0];
    // var nowPlayingArtist = nowPlayingEl.getElementsByClassName("playbackSoundBadge__lightLink")[0].innerText;
    var nowPlayingTitle = nowPlayingEl.getElementsByTagName("span")[1].innerText;
    var deezNuts = nowPlayingTitle;
        deezNuts = encodeURI(deezNuts.replace(/[^a-zA-Z0-9 ]/g, " ").trim().replace(/\s{2,}/g, ' '));
    var deezerURL = "https://www.deezer.com/search/" + deezNuts;

    window.open(deezerURL, "deeznuts");

}

var nsscBGIMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALEAAABkCAYAAADJ2tFZAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAKzFJREFUeNrsXQecFEW6/0/cnBdYkmRFgiCKgqLwVExw4qEoeub0TGd6euo7s17wVHxwhjuzonKKoCenKCIIZiUJipIRFnZh2ZzTzPu+rurd3tqamZ7ZXRhg6vernZ2e7uru6n999f9Cfe3w+/2IlVjZn4sz1gWxEgNxrMRKDMSxEisxEMdKDMSxEisxEMdKrMRAHCuxEgNxrBzUxY2NG9vWAjtLrA4T9fu+LklJwKZNwLJlQEJCZG3EpQCV24Ff1wJbvqENXYAbpwFF64EPX3Nj+NHnoryuP1bNfQEO5MPhCtxWow+oLgX+MBMYdDxQsjv4ubN7AC/cQed5Duh8SAyxanl7E4E4VsIvDgeBsRHwJjqxc+tMDBk2FVW5BMid65CSPhs+GsSOAMdWlgEpnYE0qvW1sb6M0Ym93VtSwjaQNM0iaVyw7n4cf+pU/M8TwOHH0AzU2Y/Uw0lyk/SM79W6xlF1dAJOuRLoTftVlMb6tF3oxMEgNX0Euro6utsgt8v7eOMJaIkERp9CJ5JJahItKdw5Gts3D4KXJKi/dAHqq47FDQ+KfX5ZW4Kxly7BIQOBY4gmVFUEoF9UO2WS1C4ILK1jJQbiVuBk8CYTEOPjg/SEFygjYFXnAZ64lry+Zk9X7PllHnp1OQrjSequ/A64+/Qa9B1Ujev+BCycAyyfnwB3whz0vfVhDOr7ScDzNBAN2b6NBkV9DH1RDWIGgMMpJE3blbwsauMf9PkHqlvCPrqykiQfT+GnBN+vUw7wyXvA0/8kZaqLAL557TXVGajbcRReWEo0oD9wIW3btiUeM26Nx+1nAN99BEy8OQ6Z/U7AtwsXoMDRE7663FYzQhnx4Rxqe8IEMbiYV8dKFILY4RBzJoPYTRyyvq5tD8tBqn5j47n03zz6f0tEA8rjIargDT6gKkpA/JYkMe23ehUpX6mAyyWPT1qL/OVP4d6pN+K3VwCDRtDQIt7btR+QuxE4/Sbg+/8Q+LsBxRU1qFpFnaBIWh/1QRlRjF6TxPUwvYmVKJbEadnANx+QIkT8cthoocD4fJGCuBwNDdSW81KSjq9FLNm5jWDH1tH1JRD2JpOU7NkZWLtWUBCnU1z7sItvQf4PK/DiY5PQWDUJ9aVioE66ndqm40vzCcA0xtKHfoDk2u2oq2o5kCrLgfHjqP1ziFsXRpcZMgZiTfGQNKunh/YlTb+7ioEzJ4gH54hIk0kyJLnff0hYNmhToWMJbAIxqOXBKaRjMV3vkCEkkasFkFNSxLFVpY3oM+xljL/6ZWxe+RxWvXM1upA0/s8TQhFMSifpPLgEZ97xMJwJBOyaZk2Oj2fLxhFDCewk8RsbIu2LWNlrIOaHlkBSLI4UqQU0zQ4ZTFNt50in0IsMJcjpLEFCQjy1XWPfJOZspgR2gW8qXCNHik8GMjtJ2Kbrp99HnwScc8EdeKq+H35edhLSusNwblTiDQwY8yAmTd6AqsrmQcNtmu2WkvSuqRHX1fGlJ9UpVKfFQNwW5S6JgFxCykzuTmDAYcCvv4oHGJ4USjUAEBd3NNVxJJU/si2FwwWxCuRjjhGfP//c3J6Tuqxbn1KcdvHJ8Bx6Gjb8koOsuGWo+/Un1BKFKNwlqInPogdwe3w8t713ANyLKltIBlClqQQPxkDcFons9Qggbd8hXK5MDeyC2LByOPIljfiFJPnysLh1MJOajrawEun3lxnXxxyapeaoUUKCsmWBC1MBpgQ1pKR5Ez6mm5P3Wiuog9X4aw4IE8AtS2+q7HOuaudeJ+KNN6l2ld8foMqWkhcPVBB3vFhwsZWCwPTNh/TwSSKnpAnt3E6Ni+OHP9oAgd+fSzy1wABWqFpZ2Sw5TR4dul5OwP2UBpnXGGhcmRdXVQmOzEoet23SA8NExhLbJ50jjtYSndvgwWAOyJaVGsV1Qa+Jj2ebdXyyGDyhC+2MtywANssLVCfGJHHEtALCkdBAYHD4xHe70lQoZJOMh+l0xhu2WzvHGtO+VNT0UlAn8evp82iotjGWwKmpwMCBQjkNZyYwB4P+/Eto+2Q6Z3/6Xx+F5aaBXEbn3E50JjHFzhlZ6biW6lzNb+8zQaK6LCaJIwKyTwCZba8sYVlTZ4phgi1wTSNJVmOAzOVKNUBsp/I5GDgCnPZ4cGNjouTCZ7T6jaVxT9KTEhOFdLbTpilJA5dy2of7/5KAfcYRbN/OA76nWSytk12R8S7VC3R3SfV7qoNikjjSYkR9eUUlvBgaf3mx4MmBQOFynUWSr6sE8c8G8MNRCsMzx51jgNjtHkPfP2zVDvNi5tgc2hnKyuKk9uoaIO3boXj4YL2ZkvqnuhxY9Drdu0fYpP22Z4F/SevE35Tt61rNNDEQh1n4QTC3m/8aSZYcYOxE4SnTSSwhHR0SWPz/GwYntQtMlys8i0Rdncs4l6kMqufhczOA+fdQHkg+tsGWLbiC9r2s9YCnY7sPIACTfrZmCdC5dzgANstjkhvfaqETUyTlsFMup3qibIOmH2yg+hLVXw5uEPPDZZ7HHI/jFHoSHRw6Eti1XQ/CurrfNQHL7U6zxW8jKwPoPMPo+hqp/S8C8mwGJiuNTIsCXYfBxWuEtDYVy8D94aHaWjImkvK7YQXwDgnSxHRBv/wReTxvo3o4D0Gqv7V5DNOpu6meoPntDqpXUH354AWxCeS0LCCdON4LdwHn3wAccSpQnC8ktZV+1NZmyyi0BqIhpbaVKr/fvgImJP5FBNAEwxri988PeKzJcwNKWcnDWWoLi0qosxfRfk4C+2Fyqhf25fTOwBfvkLq3Buh1qF3LRKBypuTKdso9VB8O8jvbnq2DPMe4B/vSfT9W7HRgSCRpVktS7V+P0GRVRg8uq5kzc42LG9rkana5fiXwzDPAY6eaVgE7lcHW0DDK+HS55jMbDWr14Ovh2UEHYt5WW9vsLAll1vP5iuiTec+RTcpceo6YqT5+XkTT2QOwI4SyZ6f8XwgAP0P1VEkruNxLlS4UNNIw+eADsSlxsohu7d4JLP1IKDIN9c1ArK/vRDVbKDkepw1LRrM3MDwgp9LUP0x691YQsOqCgE60X0NALStuxodpzqsoE3TDeh+BKgPdlOo+X7kwI9LE6KI6h+jsjvV2zGqdpALXVgywbfnmIPvcT/UGy3emEw9RJa4Dmiowh+rJ+45OtJVjtiUai49lWrH2W2Jug2jqHEJAKDan+COMByviemfJh23PRhwq7LKlVWIiAaqLdGLMDxlkxO1XV9F1dwcSKgWQmT6kZ5AaxLTT1TIWOdi5Gxo8TRYM3j+DBvWXhIelhKns7sHul1e8TqI6huosqtsjfAJEvvEB1eOD7HM1hLOEC3Us/k31dM1+bNE5luqqvQ/iSEMkm4HIGi8vFlsQ2RUQD62t4CgxYUs24ws4hpgfsABEniHpQgHDtAublgk7QPL7TzH2i4uro+PW23aODDoOWL5RSNLiPcDE35EqRPQzd2vwZVDNg8FrcHFz0KRkCr1gzqNAUpowq7W+fgbROKpXSkVtHtW1ET65npLjHhbg9wY5UExzIxF1MN0aEWB/r2xvONUdexfEDQ1tbYO9QL0iBjHzQHatxiUIrZ6lGoOwsTFP8lQfAazCNihNnmu6h4MDyUUcVtjU3O736O8eWzOTIY3pkg4hHHycB4wfD4ydQI9um1gEYLeNxkbhweDQ1WSamWeSXlVIzz+7p3qvzNPHQqwpOQu82oXj5oB/Ui2OoNdHSHB2CfB7obRSfC+/D5YSu1eIdpn+LaLKns/y/QnEm6leRg8ujsBTa4RfskT1ss+flLcGeqCpnQRIrfZVQwo6mvUSjrHgY4TXLZmm+O7Gg3Q6y+j/t2zNGEKi2qcTTmc2tX2eASi3Ox6ccdzOcUaQO2Fo9GjixhcB/YfS9dN9V++S5jBbFKuO+r6S+iQBmd2Az98GvnqHJvguVlXMJW21DN7fKKCbSfXTCJ4XDwI6mRFnoStr5bk2y+//JSlEis32D5UzxLj9x8Tm802gmk0Sk56io9aI5mqspodcMgRrF12Fql3DSNP+Gh7fGzjzgp8MocJKXF1tZ+zZNAaFJMnSDtsKBylVLuk2drkGUZujpSQ2oi3CuJ7QqzhaSkOXIfnd7tUh7brqeaoJyBfeKBZ/8v/slAh6LrquMqIe9YbTZjINoDRDeSsgCvLeNOqXeDGQ2ewGEF/BVKpnU+2utJYrQRzuuq+rqD4f5PfPJIWQIXs4H8L7F24ZKwfKedHPicX03dvQtBMTz0di8nN4lxTXDesc2LX6S4wcl4obHyTu+Mk4vPePOzFq3Egcc/YK7Fh7G3atuwdnnJ+BDJpGv/mYQFAyGslJ3yDfcBJUNM0QTqcDHo+bzmMv00jomAXrvn5pwmPgvB3GccJpk9mDZOGbQN4mmnWSgh/TQPeVQDPTsJNECoCqsmw6nwcJBOLZD1Uhj/h1l74wBq+IfWAwBUr5QyIbX4f5tC4MAWBuc4rlO41O/L0N2JoizXa3dDyI27JgUYA4jwA32Jj+2cQ07ATSUc/y47U/voKqopsIuDDq8ROcuO+8BZj5+LfoPehMzPgbKUdHiXZ+WU7MrqAr3H7hnaury2oClGk26whPnTVI3enMsqU48v4ZOYI2LHxF2LlLigigccGPZSlcR/d03ETgGnq2CSknGAtHmXpVlyfSZy/SD26VkjcY9ySxjdfDsP9CthfMy/YU1d9bvv8ZwmvX1sJmu51oHcPRziAOJ8agNQiSDcCJ+IYK45OXxyeTxLn83psx7YYRePqhMbjhPtJZaXY86ZwsvDrjTMxc0RRLjs9Jn9qyhcjkYJIs9P+JJ3KwzWVNM4Rp/7U7zYe7ikMMkirqh+KgsxLbtVPShUt47ZciMOerOcKqcMiAlis5AprUqH9+IL1n2iUE5KfHk0JbjwXPrcKvP16ElCzW6gfauGqe3peH+aRek9YDXbmL6qPKvhe3I8a47TxJfzoIxO420GKncxQpOEca0pzDFLmtWvo/lw31NGV27/Ekpt0/Btt+BK57DPh5NU1SjwgA8zOfR7Pbk/9LUvqSK9B3YD7S0yFNad6mB2+tdoFpH8QOacJbTQPwh6AAZuWrnJT2l+iZr/qE6YBYts883tdob3AxBWEld8cGN+kJK1GUdwjWLvGQFJ5Cktllox3qWGPVRjilv1QOdeVSCVpIRe9dqKGo7VNekxL5044BcW1tW0C8p8mk5Xafh4yMx7CnUEyvuT/1xcYVT+D3RImWzQeuHyGU7UNJeX37H8B8moorC2sw6KzT4EhZimyScL16mS7b1CYp7HKlU7XvWQxvRXQRXfcquv4eAQcA04Cs7mI50tPXkiQlKdyVdk/OkOcKQ6cQ/PsoJKbehG/m9kdjfWfE07TF4PbZ4uMshdeE+ZSOs2kDnifNpR1V+FzMH39sfxB7vZECmPnwScYgEMrUIjTStpWkpC14lR562S045eLeuPheYPUXxCNpoP99CXAn9d0bzxEIqI0Bo+ow5ZKlxjKfRJl2lUHs9y+k9s+SoFpC3+0rdea12Sv1BKqNtH/3gDy2c0+6lyrgcZph139LA62/3eCeQOUw1FadTRI81cj7Zp8CMXhntYMFitf1TUDzCo8hEsC9O1j/YqAthHCG5EeHnViA+OSmYBenMwOJdJ0uklC7iSfmDPk3Nqw5FeekZcNHStPQ8cBbpNBU76Hu6iGWwBdsSUXn9C7I6rbLWIZTVi5A7HJxtp8ZMhxzPp2nzpbSxaBjd21mFlCUL6SbwxlKYnKc7bFaWsIxvSVE1x+dCqz7DujWD232cPKUnZo9jOjI76mthDAG3BuILJbX6gxhKchRbaab+iR5/0l7yaTbRVIK7u+K9gNxpFq/05lIUlgkNhHLgUpQTjxx8EgCKQ3yWsenqKkZiCNPGIr83auxfjF14QLhjWIFp5RAe8FdL+KwQbuMfL5eepilZSaFyLQ83Axbko/34Zy/KxeIlcdjpwoAs2nLmyAWdXJCa2crRfZjuvZsQ1L4/XVGf9C4MrxoG+k+XryToEMSuHt/GwlYeNBVC1uwrl/5eF9DNa6Ylor1332Nb9/rT+eykzmbPWdvRfiMF1oAPArC09cWG3BbyyA5cE5qPxBHXjJIio9tyrLj8RQaLuN+NCsdQ/z3ddI/ThkGPPLsGiyaPQXP3vME6qsPMbhlTp9yZPZ5CuMu+F9jAFTQtvJyYd8VK5xbKnN2Blp8ogDqf/4O0vaBFZ8I8HJAEXPaCf9Nuv8oMYBqKkWshhFRVsvIftJQ8jiqjh0OPxL9Wfw68PW/xf52AMyFlxPl9KX7P6t1fHTTbEGDqufgoeh8aGds++ldFO+8inhxMEnol1J4a4TPid2/FxmDtRnAN0sb7r4q/yUH5fntA+JIpkcRgXV803IhjxGsMrfJHduPpt1UUtRqZbKeQUe/gz7HzEdGzhHIzvCiIn89at15pKUTsIYIiwSDmAEsTGoJhtVAZP4JbWIzwjq7AYtICd5JCnxnUhB/WMxSD0akIUedrSNpOvF6EcPMoO5/lDCPxZH05qQnCUl+rCfJu/A1AV4D/NRmSkJ4FILBez6BeMgJQvKrA9DlcqAw3w0PBuC0azMw+6HnafDdYgT86MvX0hERsSFUDgKzsM32Duz7wt48DhS6bd9JYlbqzPVvbvdSohYbjIddUEDckR5+V6oVMgakvIRBUYkBI79GbwL48s0EHFdz+ldeQcxteTymQ2EztbmBHvgA+l4Zkk5wJFxpgYg9YJc2x+Xy6ogm4LjFWr5/3iKkfSpx5owuPCMQsG8A+g4lufBXYO40EYTEvJr34cERjvWBvW/baWAuISk+fCy1VdEaxGyWbKg7Eo0OXs08Cm7PODQ0psFlrGlrNTylfbUtUWHWjuMEKlcgesqtkp8/ufdBzJKxpma0YZlg6elyLWsCGQOOvW4jjgR+XtLSYsBSsLKkpUTnn00qYfJgDr10udbR9wH02ZPoipO26dHEmxmMH9PzWf+dmM5VwLPCxwFILKFNnsyg37mR+C4dk06UeM8OEQJpxvH6IkhHy8d06iacIawIcupXIyO8o6Uu4fN7jWuKT8qhwZKH3bl3EwenA3Ga0iJ1oDaHRCTlkigDsFmmSWvFrEgbiGxlh98/nCjAEU1Z2OPi8g0wm5VBNHw4SSaZhzfYosp6n5DEZq4Is7rdS2QOiQtoUCS0aN9a6Scjcm7zcth6fwCDniUzS81OPUXATVkRkJwp4h/aan3gwVKcB8z+q0hH4PG2NutxYQWw52GziR/TIN6zi679drSMh6iTToLd7QSWXoje8mZbFD1nK69YqCqCZaYYUpi/i5XIs5okq1j+TlwyGRhzqpjNAgXWcFvVNa1TPYl44NkE4HrDexdoaREfxxaJNUuJoiwQXDcc+63hRfMK8Ibj2g7VJsdWrCTF8oeF4n/dJML3Xl+/CqmdxeBzOH6UXPUnixSe145AeRHRnXPiQ0SY2MUd0YOrr59sgFjkTFtE3/NbSDCjTarDxgop6WvQK4cMRE6DqsuU6XD8Sm1vpc8BAakEP3wG4eI3RCKWnIxIl7bz6oajZCeyxOKpPUfSLb6ZXZKXboNYlbxcOh/0nWeslaO+WUJje/h4YfFoqGs2+psxG1WlaTj+XGqN89Tt5rgM4iFGBss7pTJW2I4gYbcvh3bOiVIQx0lz4JGyvzuQE/v9aQTaHiIHcQKb136ibQ2tAMoAKyI+WNNLv1zHSG0VJ9bYsZuap1fVhutyTae2OMLKpdVXMrsK/smpnpjLhgdgjifgVbr8Mo/BNkCuFs6ftlhy1o9a3RtL4B8/B1YvFjbrbT+Z6bs462aNkVuOs8l36w8cR0Ce/Wfi5MYgnE0tFLTBpBas8LVyiOVTUQpkTtTCK4Q4HNV2tlD7q4jNXL9O53k0jScbR4t3Ycxtyn+mVt6/prZZOrNSxa5WDgTnRZE7twBfvk+/kUTO6S32t1a3+59Uv6D/e7X6jbks569gacfKoic+nIE7XU7XN9sAcKDCgTW8iJLXnZEWZwScu1vwfU40/uYDAsjJWbwQgKnWd/TbNyJbKNvIaQCPPhvoMdCq9C6RktOGlahBP9MFLk9T/WsU04ojYIQzhsOJmRbYrayA1dSUStcw8+FtJJGXBVyWztKaY4wZvEmZYprlaXP7epLSNDPPegT4C0mpRy8kDkkzST+azXsMEK9/ZRridDbQec4mybXDyG/GShMPgATisN1ov09nAl+9J7hwcGsCx8rebZm2bmrnjue08s9LijG1adBykNCOzTSBPy5oj9NtBgH5DOXSWP5fIawYY0galxeZtMqPoAlJHELalxcI9z07ebgdh209/W40R69FYyEOZsRM25RK4bzv2LAm1I9ucjW73W/R94rAGXN4qRA9jwICbimB9pu11OE0SxTvklLdLXJPcLKQZwln+VuEdGJP26jfiEQiBb8WGg+Hgc3uXH7QPFVzPO9T18klPQnBQMympRnyf+aYz8nPrA7o/IHSVMS5gP+HrmkXuhKdWvsF8DNRi6PPEGY9jhpzsE08TgCypBw45nxgKTGJsnxJK/yBFUeOY2VBMpL6aOg4Ei7Uz5+R3pZLumGGbVp1qeT9p0YpkH8n9ZA7Q4M4nPT7QqOebEgLr7G8/rOgJikGJEeAvUMUbP1SEUvLgEzJaGnKYvstc+JX/yikCkspdvuecQ3xSemZXPymeEk3T7n8kpf8zYKa8P/BpbA1uGdECzNXxz4ATiZyPt3LUkOwfvAsTZTHEwWimaS87As0YAicDY2GVbCWxlR3ksYnTiH68aAAsalb8L2xtGXFkClIfYP47H8acOY9NDPRb3k0uH9D/8+h/iugfknvZhfIvCD0ezmFR2P5gwTyjOB0wjDs26widrhYgrjWyNUQKMs7v8OuC0sheoY/fEpyjylCkpSavtZOAp5u2W7blahmp0OEE+IxEqKLZwna8PjlwKYVIul07i9igLBzoiWAWQF8XGrgfeU264tqapu1wg4vORBhpFcYQU/sBn/mZnFqp/8uxHHQU2MGvNQXcWwrJwk87hygJwnz0j3N/cI0imee7rQ9KZsG9WVEu44TvzGF4LegFu0QnPtcomed2cGSZ5da1MnBti2KqcV0hIixcIe5EqLZVux0riepvFAriVkKpGQJLxinZGJ+a/cFMKYE4eAujml4TmYm7dRdcGLr+Vqf+3RjGm+mDtcov3v2wUN4ka4zGYmpM7CDqEQCz0YJpago2AOHr0uTJYfzWHSlcXfKxaR6kUR1OwVVSiUhefSJwGE0iezcI1zkH9M4zd8jB7BDWD34PXo8001+GJhLUnn3JpGlKLRE5hHD4ZnfQER5R2P5l1R0P2+7dULYczNlvERcQIcIJ0NhKfnekyIgh71h4dqjjei4BOFZ4+SD/PLw0N40a16G1KZ7bA3ivfwmRP906o9LjUH92Vsko7vxyudL4PLsgotjsL3C3FhEusJpRFWvuQ84fALJSZ5YEsUt+OW78DgwiU1zqjnSBDJTkckkkTvRgCjeYVcis4NlAqK7sDPkUD2Iwy1O5yLpaq4ylEL22Fkru4JziEas/Igm0zekxyrss7BE+C0BP93gx/YTklhtTY0a6bvvXsju8b5CA3yMscRp7rP8GrGvkJD8dtMre42XRrLthO51Ek0mg08TjiBe1MImNDalNdbLfgjkxpdA5pzGLJFz6JlXFtldd7gU7RQa2UElWdrlO7UGsd10qVzF8v7PZHzEi8Z3dR8vSY7CnWIpO/9v2G+DApBFCse7DrVsu18a5q0vErxajsbjNJ4eHV3wBpDEzr0vieXMkpjyPlKzM/D09TRLPVWKzJzlTd5K5r687D+PQLh1A/VlhdiGMBctMJDLdolM/KfcKOOnbZvfOOHJrVEMZPakLlSeeQSxE07nV01vMTLTk5qV85DxdPb5bJGalN/xHJqT8TQ2Ey0Te/RXPk2FjVfi3m4BJJuzOEfuWA2IXQGAvQ/T2foyiFa8btiPX7gT2Lwa6NFXOG2SiDbtInq6LU/g1tmGPBsM5BISJF2o+8bfKBI2cgShPSBzsPxj+5MzJJIl++sJyFX0QAa0mKYM4z7x4GLqvK/nSh6sPX4chEvxO/m9q8JhrbSgxkIDapR9+jc5FoDrIbxcDg11UIHt3KePwNd4JlKzzkJFyfuY8Xug1+GkWuUCA4+nuWgiXa1bBiO1lYZTA1UlwIhJ4vuC6WIC4uxDoQXLH6R15eIoBTIr8C/L2bnBHeFrWv8KlyunlZmsax/gHRrEW9dQF/TTdZbJa3iRYDpa5hJr1FABKyVQRVOiBvQ6Jc6tANuxT+hESwvMdKRmzsPOTX5sWEkDn2a0Krr9IWcJysbeUW8y53cjusc0JM0ngB1GbIgRYNUgzG0jzhagNoAMu0BmJxGvAj8pSoF8GUTSw4edhimLg3DMyiseUjNbxku0rjNIgj/T9N44hgUDeMc66qiXZE4GbSelWcCZpHBar0aKmtscFlDquK5LA1hXAMXOGQUPoDcB7CrDgtOpB5BNXXDUicCRw4BhIwjM9Fmy/lF0ytmOqrzt+PbdB+FNihPOIkd4rzZjILOV4igC8qk3i1dL2KcWEyRdi9ZyjgDCrD8BW1YL6bn5B7EWjd2//PI/0zJgvjixuZRSR/7UtEyenRO8RP7PpNzu3iZsxAF0dFNuW8CoA3GiBrAuZZtOiXOFoBP7TrFrXe5osvaxo4dt6fkkBPLWC678xZsX4ubHu+Gxmd3Qvfd9eOeJr7A7V6TLZadRY30cvN50YxmVV3aXsdxLqYYpzi+sFiMnE0e+SXj/Gm05LZnC8aLOHVEK4pfEg+Z1ZRyHYM6y9TLY/ZppMiiluDkRNruGOX2T05KJPZWUt4LtRDAuoIHwk8zNENANbAVnnAIyU+nyWaS01wJIjwJ6t00Qu5T93FEC4gGGpcVBijKn/JozgwCaJZw6burnYSc/j5WfPYiT6BncT8/qgctH4KU7bsfUez/E9rX3orh8JN6bnoS63V/i+AueQWrXRYb9OBhHLt8NHDuFBA0NlDWfkLDpbKcrOLbXdIYkRBGAOaZihnjQHAFmjEp5M+xg4OXsL90NfPmuGLXsOWOKcOkjpPH2pulpt8hsbuROI8D+hSTwRpLiPVsl1uOVrOOl2K+yANCpAaUJMLbjxWsAq0pgl0bCh7JOuKNIEnPhxaFfwcdufLrMUSfDWEhrXJ37Ifzt6psw6aos9B9Oe94HLHzjT/jk8cdw2V1EPU6Fka9j/ffn4KWHz6HZ0I2Q+Yr98k2l9Hy9SeFoB6sltVgURf32SvNDdcjVES2Yq1zGzu8UNmlEeaWIILtuush6ufwjksA0vRVsEzSkWx+dBOY8u5z6nn40vEJejfSM14DYo5HETgXYHo2tOBRP9soaLSDmrO3XGgHVPLsZ4au0pZbzZ/zjaqzdGoebSa96eS3dDU1icVlePD4PGHx0cwv8kpqUrLk48myfAc6QPFm6s1e+DRRuFdTEXmGFnAOb3tiH/VUjBeKH0Ey5aGVpYPqQ2bV5Wybd/MYVNK1NEgpgHimGhQU0wcSL/fRvvSwNAFhYpqYECyhdGophh//qpLPLohRa6UwCws+w3lGF5/Nh8HhWGFf56jMESA5NXXYfurgexCya8qfdClw5XCwumHCVAHAVh7duBGaSPrNuzQrcQ/w5OdNvRAzaUfZYmUwgyvL6A3QFYWWwelOaRB/fB33FsROcu/l79Qf7RmKfDOrh7Dm5G8TiykMsmXH01oh4xQYcr/kt3SJNvQHAq+O/OmC7Q3DiOFl9iJ5yFJzuFcZ/P8yiqyWMVDT2Rh8S0mUkA+qLRAjnoLEkdYneTSfF7Of1nN+iAt6GOfjL+1cip18jireLoKHQ5j3qAbnqJLKV3U9Q5Syit+zFPuK0u2zw/lX3Y5ieDr9IF2XqZ6E7wQRqShAQJ1moQFwAoHpD8F+vRuq6Ayh7nigDcfP6PQ5yQrkTnTLuxy/LduLDl29DbX4CBp1IhOxI0lM4w+hnQAb1f23XTUgffhmKWfHeKrxydk1v7mSx4iby3NS3Som8N2ItFksJXBbwdjr4AlSgxml4rG6bOwjX1UlnTwA7sUPDk6PFOmEWdigcanA9p2ccXVof1O92o6yiEFnpDjgIcGwG5RkwqwuQ3Umsyzv9/G0YOI4TNxKtyw8vStBbJhwqzja9QmKqBPKJHdg3b8vzBL25toCYszkSsTJW5uqK02JSS9JIYp19OJDZLRSdCGSdiNfwZHeUSWJW7s5rHmwco0K36KvvYzw7fvUzT/1cjbV1TOfjC+CqOhceohBbckXcSjhx4WxZ2rMhHKUuUGH3L1OhgR3QL/8Hm8FIdkHM6ZV4abs1Ed23EEvVL7coTeMgQvoqJKBUOhGnUex0VMGqvMVpbL12FDu3PIcKYk+USeLEABoYmmxgLQBKWE9NdmLBS1PxbtlrhmUp3Fhtjmxjrywr6A1tWqlVLZ85vwo3px375I5wlEe7IOaFj5yv4E4pxZzyoq0Z1tmz8x8p/t+SADaBmqx8BpLEHrR0MZu/e2wqdjrAOpX7jTY6EX5pbMxCavarVE8jgP8u4sxFDe2y1NDqDPG2Q3vW94jYKoHU2RuVKcKvWBkSNZLVDFbOseyj0okMDV9WObEHei+bHUmscuKE/YBOtKVcSACeHwXXsVLSorZK9TMRQSoBZwDpzKk2LRZ1ZCogND+tQRImZUizANergD4lBIi9mtHsRmuvmyOAYudS7i1Oo9hFG51oD176fBRcx8dSikZS+BVhYyAS0aA9QJwgAWKd+lMVgGZYtjsUQGcpnDeQYhevoRMqdbBKZyigVWmCSwGxQyPVDzRJbBbOPhQNa+ReQ/gJvDmR4rFSQUR7gbin/LSmAk22mIOsIE6xSFdzkWa2BsSpQSwR6jY175pXw929Gumss0Qk7QcmtvYqLyA6AnRYIZtuc1+OxeD3iGxvywn5AbON8i4NiK0vRDFB21cjiU0Qpytg9moGgVsjid0hpG4g6exV7sOr4cnJaOkAOZBBzLrIlVFyLezNC5V9k5eWcc6LyraejB8+pzT9iwWE5nsCumpA3EkBrNOiyGUo/DkpBHVItEkndJI4TtnmlOdQPXaJBxGIuVwdRddyLtUvA/z2JMQL09ulOC1Ssqvy2cUCwEwFxJmWNroo29IV6WulFp4Q2zwB+K9bw9u9GkuEQwNsp8KTD0RObJYj0DGOh7YonauUbTzr39aeJ3FagNlNfvZQAJtkoQw5ym9W0KYrip1O6qrUwaHZ5tVIYpUnJwYAtktDMVRXlusAlsRcjouia2GnF+ca5peUcwqG36Dly9Dbpbgt3LeXQieyJTCsHqVsi0KHADQiVR7nUfZxawCbotmmJhqO10jnNA2wVXOaCWKnZuD6DmAQ94+y66lRdC50BIi7KyDOsUy9XRQQp2n4bpryaVoxrGBMkr+7FYtFliIpUzUgTtSAOEUDzlSlLYcG2AeDJO6Mg6wwqAbI/wcqIDYtFU5FEscpgM2SFMStgFjlxJkKVUiRFMShSOx05RozNcBO0kjiTA0nTtTs5znAQew5GEGcqihiXmUq9ysd5NUoY+kafqoCyqXhp+p33TTvD3CcQ7OfXXAeyCAuP9hAzOAy8wqsl5/W0Epeqr3H8r1QdpJ1MVeR5VjrccVKx25Hyzer83k4+UWjclye0lau5sHwUhU1eoVz7FoTCjbI661V9qvCvkws2PFl+8EIYjOnwGb5maeAxQrYYovWad3GizutRutdCoh3y9+rFfCXKCArltuspRSt36SzEy2TZ5uDwgriegniekXSVx/gIF5zMILYXLe01QJALmUSQBWKJNaB2PrZIAFVptnHCmITrFbwV2oAW64cZ7ZnPa7RMphgOVeuAuwqee0HKoj53r48GEGcr0xDOyzS0y8fvCn1zH33aABaapGwfmWfyiAgtg6IMg2IKzQgVver1YC9Xg6mWsXcU3kAg/gjZeY8aEBcptCIHYpErrQAskDDm3croCy2SD0ooC9WgAhFYpfL8/kUEKuA9SlSt0ozSGrledV3dlRC+3LHA6I8hoOwMIj5nVQfWMC4W8ONixRgl1i0/J3KPqUaQBVauCyU/SoUwPot2xolyKs12neNcpx6zmoJ2jpl4JSgfVYgRFvhRZXfHawg5je7T7SYnXI1Wm6xovxZFbxSBZRW3lyp7F+kAXG5RjpXWn7zBQBslUYS1yogVsG+R17DgWZL5fu/Hgdp0cUTmwreFg24cjU8uFyRzgUWIKrALtOA0eTZdZa2qhSA25XEutd9lSvH1iI60ru2Z5mI9n2Z+X4P4gpFUkID1CILKP0KDSm0KFblAaiGjqJYFThVSldZrAx2gV2lAXGFvC7HAfQMp0AkGEEMxC21eo73XKsBXKHyvUhDOYo0ElwniVWgllv4a4HyW60GlDUaEFdrLCJVCogbDhBJzPoFB5W/g4O8BDI1qfGefgWEFRoOWq6RfLUKsMst7VUqYKyznKfOMqAggedQriXUq+UdmoFqegfT9/Pn9jTVB9DSjBmTxCHKu1TvtQDIL7nzJss+BQrHtYKwwKJYmQArVXi2lWrsUNqqtWwzXdzW5HI/K59cVstP61sozcWI+6NXi61InBVnOERKhRiAQ0hitSzW8K7zFOrA5h1OO7TEso0XDH6lAPVh+VlnaZszLS61HPesBPorlkFzm1RgzJdVswnwv6mOlJKJCyfw+CPVfpZtc+QA5Mi31+W2a6neJLfVBeHIDhuSPpwSTnsOeW075ID8VgI5VpTy/wIMAHT2n9lN84efAAAAAElFTkSuQmCC',
deezerLogo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAMAAAC67D+PAAAAz1BMVEUAAAASql/wvx0SqmHwwB0Tp3nvrCHsYDISql8Sql8Sql8Sql/wvx3wvx3wvx0SqmESqmESqmHwwB3wwB3wwB0Tp3kTp3kTp3nvrCHvrCHqpiV4HYmXH3sUnoYSoIYSoIbsYDLtYDLXVkGELn6KLXoZfbYQg7sQg7v4jhX5kRPsYzDtYjHXWECELn6KLXoZcrwRd8ERd8H4jhX4jxTtZS/tYjHXWECELn6KLnobX8cTY80TY834jxTtZS/tYjHXWECELn6KLnobYMcTZM0TZM1ezdCaAAAARXRSTlMAAAAAAAAAAAFfwlAFCgRHkjxq2lFn1Fg/gjMUEkCBNm7ia8m1d+JdLyM8eDhoXj94Mu68fOxvzbl87GIlGS8WKSUZLxRqv8R1AAAAZElEQVQI12NgAANGDg5GBiiTk4ubgYGJh5ePiZlfQJCBgUVIWISFVVRMnIGBTUJSSlpGVk6egYFdQVFJWUVVTZ1BQ1NLW0dXT9/AkMHI2MTUzNzC0sqaQcPG1s7ewdHJ2YUBAQBlOglj5Xm2JQAAAABJRU5ErkJggg==',
sccid = 'a7f6658adbea8581e9e9f95b9a82e4ab',
ssmInnerHTML = '<div style="background:url(\''+nsscBGIMG+'\') top right no-repeat #fff;">\
        <h2 style="margin-bottom: 15px;">Stream Manager \
          <span style="float: right; display:block;padding:2px 5px;border:1px solid #444;background:#efefef;cursor:pointer;font-size:12px;" onclick="murkCloseGraceful();return false;" title="Close">X</span> \
          <span style="float: right; display:block;padding:2px 5px;border:1px solid #444;background:#efefef;cursor:pointer;font-size:12px;margin-right: 5px;" onclick="murkMinimize(this);return false;" title="Minimize">_</span> \
          <span style="float: right; display:block;padding:0px 6px;border:1px solid #999;background:#00B3A6;cursor:pointer;font-size:19px;margin-right: 20px;color: #fff;border-radius: 13px; margin-top: -3px;" onclick="copyNowPlayingToClipboard();return false;" title="Copy Now Playing To Keyboard">&#x2398;</span> \
          <span class="skipControl sc-ir playControls__control playControls__next skipControl__next" style="float: right; height: 10px; width: 10px; margin-top: 6px; margin-right: 9px; cursor: pointer; margin-left: 0px;" onclick="ssmPlayNext(); return false;">Skip to next</span>\
          <span style="float: right; height: 10px; width: 10px; margin-top: 6px; margin-right: 9px; cursor: pointer; background:url(\''+deezerLogo+'\') center center no-repeat; font-size: 0; text-indent: -9999px;" onclick="searchOnDeezer(); return false;">DeezNyuts</span>\
        </h2>\
        <p><button onclick="trackKiller();return false;" class="murkupdatestart" title="Kills all tracks before the current track playing, or the tracks above the ones you\'re looking at">Remove Previous Tracks Now</a></button></p>\
        <p class="murkrp"><input type="checkbox" class="murkupdatestart" title="Removes Repost from your stream in real-time. Only see tracks directly uploaded" onchange="if(this.checked) { window.totalMurkHandler(); }" id="shpmrp" /> Remove Reposts</p>\
        <p class="murknonrp"><input type="checkbox" class="murkupdatestart" title="Removes Non-Repost from your stream in real-time. Only see reposts" onchange="if(this.checked) { window.totalMurkHandler(); }" id="shpmnrp" /> Remove Normal Posts</p>\
        <p class="murknondl"><input type="checkbox" class="murkupdatestart" title="Removes tracks that do not have a download available" onchange="if(this.checked) { window.totalMurkHandler(); }" id="shposdl" /> Only Show Tracks With Native Downloads</p>\
        <p class="showtruetimes"><input type="checkbox" onchange="if(!this.checked) {window.shpDateRevert();} else { window.totalMurkHandler(); }" class="murkbox" id="shpstt" /> Show True Times on Reposts</p>\
        <p class="forcenewwindow"><input type="checkbox"  onchange="if(!this.checked) {window.shpUnmodLinks();} else { window.totalMurkHandler(); }" class="murkbox" id="shpnw" /> Force Links To New Windows</p>\
        <p class="shortremove"><input type="checkbox"  class="murkbox" id="shpkillshorts" onchange="if(this.checked) { window.totalMurkHandler(); }" /> Kill Tracks Shorter Than <input type="number" value="0" id="shpshortlength" style="width:30px;" /> Minutes</p>\
        <p class="mixremove"><input type="checkbox"  class="murkbox" id="shpkillmixes" onchange="if(this.checked) { window.totalMurkHandler(); }" /> Kill Tracks Longer Than <input type="number" value="25" id="shpmixlength" style="width:30px;" /> Minutes</p>\
        <p class="killwanking"><input type="checkbox" class="murkbox" id="shpkillwanking" onchange="if(this.checked) { window.totalMurkHandler(); }" /> Kill Tracks Older Than <input type="number" value="15" id="shpmasturbatelength" style="width:30px;" /> Days</p>\
        <p class="gimmebackdl"><input type="checkbox"  onchange="if(this.checked) { window.totalMurkHandler(); }" class="murkbox" id="shpreplacedl" /> Enable Legacy Download Button</p>\
    </div>\
<input type="text" style="display: none;" value="" id="ssmctc" />',
deadoutconsole = '<h2 style="margin-bottom: 15px;font-size: 20px;">This isn\'t your SoundCloud stream, silly...</h2>';

// Turned this into a DOM element injection. Thought it could be the first step to freeing from jQuery, then
// I noticed this entire script is fully littered with the shit

var ssmPanel = document.createElement("div");
ssmPanel.id = "murkconsole";
ssmPanel.style.position = "absolute";
ssmPanel.style.top = "-30px";
ssmPanel.style.left = "0px"; 
ssmPanel.style.padding = "10px"; 
ssmPanel.style.border = "2px solid orange";
ssmPanel.style.zIndex = 1099;
ssmPanel.style.textAlign = "left";
ssmPanel.style.background = "#fff";
ssmPanel.style.width = "100%";
ssmPanel.style.height = 0;
ssmPanel.style.overflowY = "auto";
ssmPanel.style.boxSizing = "border-box";
ssmPanel.innerHTML = ssmInnerHTML;

var jqsrc = '//ajax.googleapis.com/ajax/libs/jquery/1.11.1/jquery.min.js',
shpActionList = {
    shpmrp:'repostMurkHandler',
    shpmnrp:'nonrepostMurkHandler',
    shposdl:'onlyShowDownloads',
    shpstt:'shpDateUpdate',
    shpnw:'shpModLinks',
    shpkillshorts:'shpKillShorts',
    shpkillmixes:'shpKillMixes',
    shpkillwanking:'shpKillWanking',
    shpreplacedl:'shpReplaceDL'
},
shpMixDuration = 25,
shpShortDuration = 0,
shpMasturbationWindow = 15,
murkConsoleHeight = 335,
shpGetActions = function() {
    var actions = {};
    for (var a in shpActionList) {
        if (jQuery('#'+a).prop( "checked" )) {
            actions[shpActionList[a]] = shpActionList[a];
        }
    }
    return actions;
},
totalMurkHandler = function() {
    var shpactions = window.shpGetActions();
    if (shpactions.shpKillMixes) {
        shpMixDuration = jQuery('#shpmixlength').val();
    }
    if (shpactions.shpKillShorts) {
        shpShortDuration = jQuery('#shpshortlength').val();
    }
    if (shpactions.shpKillWanking) {
        shpMasturbationWindow = jQuery('#shpmasturbatelength').val();
    }
    for (var act in shpactions) {
        if (act !== 'shpModLinks') {
            jQuery('li.soundList__item:not(.'+act+')').each(function() {
                window[act](jQuery(this));
            });
        } else {
            jQuery('a:not(.'+act+')').each(function() {
                window[act](jQuery(this));
            });
        }
    }
},
repostMurkHandler = function(rel) {
	if (rel.hasClass('repostMurkHandler')) {
		return;
	}
    if (rel.find('span.sc-ministats-reposts').length) {
        rel.remove();
    }
    rel.addClass('repostMurkHandler');
},
nonrepostMurkHandler = function(npel) {
	if (npel.hasClass('nonrepostMurkHandler')) {
		return;
	}
    if (!npel.find('span.sc-ministats-reposts').length) {
        npel.remove();
    }
    npel.addClass('nonrepostMurkHandler');
},
onlyShowDownloads = function(dlel) {
	if (dlel.hasClass('onlyShowDownloads')) {
		return;
	}
    dlel.addClass('onlyShowDownloads');
    if (dlel.hasClass('shpReplaceDL')) {

        if (dlel.data('downloadable') === "false") {
            dlel.remove();
        }
    } else {
        var track = 'https://api.soundcloud.com/resolve.json?url='+encodeURI('https://soundcloud.com'+dlel.find('.sound__coverArt').attr('href'))+'&client_id='+sccid;
            $.get(track,
            function (result) {
                if (result.downloadable) {
                    dlel.attr('data-downloadable',"true");
                } else {
                    dlel.attr('data-downloadable',"false");
                    dlel.remove();
                }
                return;
            });
    }

},
shpDateUpdate = function(del) {
	if (del.hasClass('shpDateUpdate')) {
		return;
	}
    var inst = Math.floor(Math.random()*9999999999);
    del.addClass('shpDateUpdate');

    if ( del.find('span.sc-ministats-reposts').length ) {
        del.addClass('shpDateUpdated');

        var timespan = del.find('.relativeTime'),
        tdt = '',
        but = '';

        if ( !del.attr('data-uploadtime') ) {
            var track = 'https://api.soundcloud.com/resolve.json?url='+encodeURI('https://soundcloud.com'+del.find('.sound__coverArt').attr('href'))+'&client_id='+sccid;

            $.get(track, function (result) {
                tdt = result.created_at;
                del.attr('data-uploadtime',result.created_at);
                del.attr('data-duration',result.duration);
                var dt = new Date(tdt);
                but = '<span class="brainzuploadtime"><span class="relativeTime" datetime="'+dt.toISOString()+'"><span class="rp-time">'+timespan.find('span:not(".sc-visuallyhidden")').text()+' ago | </span><span class="actual-time" style="color:#000;">Posted '+parseSCDate(dt)+'</span></span></span>';
                timespan.hide().after(but);
                return;
            });

        } else {
            tdt = del.attr('data-uploadtime');
            var dt = new Date(tdt);
            but = '<span class="brainzuploadtime"><span class="relativeTime" datetime="'+dt.toISOString()+'"><span class="rp-time">'+timespan.find('span:not(".sc-visuallyhidden")').text()+' ago | </span><span class="actual-time" style="color:#000;">Posted '+parseSCDate(dt)+'</span></span></span>';
            timespan.hide().after(but);
        }

    }

},
shpKillMixes = function(kmel) {
	if (kmel.hasClass('shpKillMixes')) {
		return;
	}
	kmel.addClass('shpKillMixes');
    if (!kmel.attr('data-duration')) {

        var track = 'https://api.soundcloud.com/resolve.json?url='+encodeURI('https://soundcloud.com'+kmel.find('.sound__coverArt').attr('href'))+'&client_id='+sccid;
        $.get(track, function (result) {
            kmel.attr('data-uploadtime',result.created_at);
            kmel.attr('data-duration',result.duration);
            window.shpKillMix(kmel,kmel.data('duration'));
            return;
        });
    } else {
        window.shpKillMix(kmel,kmel.attr('data-duration'));
    }
},
shpKillMix = function(kel,d) {
    if (d > shpMixDuration*60*1000) {
        kel.remove();
    }
},
shpKillShorts = function(kmel) {
    if (kmel.hasClass('shpKillShorts')) {
        return;
    }
    kmel.addClass('shpKillShorts');
    if (!kmel.attr('data-duration')) {

        var track = 'https://api.soundcloud.com/resolve.json?url='+encodeURI('https://soundcloud.com'+kmel.find('.sound__coverArt').attr('href'))+'&client_id='+sccid;
        $.get(track, function (result) {
            kmel.attr('data-uploadtime',result.created_at);
            kmel.attr('data-duration',result.duration);
            window.shpKillShort(kmel,kmel.data('duration'));
            return;
        });
    } else {
        window.shpKillShort(kmel,kmel.attr('data-duration'));
    }
},
shpKillShort = function(kel,d) {
    if (shpShortDuration !== 0 && d < shpShortDuration*60*1000) {
        kel.remove();
    }
},
shpKillWanking = function(wel) {
	if (wel.hasClass('shpKillWanking')) {
		return;
	}
	wel.addClass('shpKillWanking');
    if ( wel.find('span.sc-ministats-reposts').length ) {
        if (!wel.attr('data-uploadtime')) {
            var track = 'https://api.soundcloud.com/resolve.json?url='+encodeURI('https://soundcloud.com'+wel.find('.sound__coverArt').attr('href'))+'&client_id='+sccid;
            $.get(track,
            function (result) {
                wel.attr('data-uploadtime',result.created_at);
                wel.attr('data-duration',result.duration);
                window.shpKillWanker(wel,result.created_at);
                return;
            });
        } else {
            window.shpKillWanker(wel,wel.attr('data-uploadtime'));
        }
    }
},
shpKillWanker = function(kwel,d) {
    var system_date = new Date(Date.parse(d)),
    user_date = new Date(),
    diff = Math.floor((user_date - system_date) / 1000);
    if (diff > shpMasturbationWindow * 60 * 60 * 24) {
        kwel.remove();
    }
},
shpModLinks = function(mel) {
	if (mel.hasClass('shpModLinks') || mel.hasClass('playButton')) {
		return;
	}
	mel.addClass('shpModLinks');
    mel.attr('target','_blank');
    mel.click(function(e) {
        if (mel.attr('target') === '_blank') {
            e.preventDefault();
            window.open(mel.attr('href'), '_blank');
        }
    });
},
shpUnmodLinks = function() {
    jQuery('a.shpModLinks').removeAttr('target').removeClass('shpModLinks');
},
shpReplaceDL = function(dlbel) {
	if (dlbel.hasClass('shpReplaceDL')) {
		return;
	}
	dlbel.addClass('shpReplaceDL');
	var track = 'https://api.soundcloud.com/resolve.json?url='+encodeURI('https://soundcloud.com'+dlbel.find('.sound__coverArt').attr('href'))+'&client_id='+sccid;
            $.get(track,
            function (result) {
            	if (result.downloadable) {
	                var dlButton = '<button class="sc-button-download sc-button sc-button-small sc-button-responsive" aria-describedby="tooltip-597" tabindex="0"  role="button" title="Download" onclick="window.location = \''+result.download_url+'?client_id='+sccid+'\'">Download</button>';
	                dlbel.find('.sc-button-more').before(dlButton);
                    dlbel.attr('data-downloadable',"true");
	            } else {
                    dlbel.attr('data-downloadable',"false");
                }
                return;
            });

},
shpDateRevert = function() {
    jQuery('.shpDateUpdated .brainzuploadtime').remove();
    jQuery('.shpDateUpdated .sound__uploadTime').show();
    jQuery('.shpDateUpdated').removeClass('shpDateUpdate').removeClass('shpDateUpdated');
    jQuery('.shpDateUpdate').removeClass('shpDateUpdate');
},
onjQueryAvailable = function(oCallback) {
    if (typeof(jQuery) === 'function') {
        oCallback();
    } else {
        setTimeout(function () {
        window.onjQueryAvailable(oCallback);
        }, 50);

    }
},
gmloadScript = function(sScriptSrc) {
    var oHead = document.getElementsByTagName('head')[0],
    oScript = document.createElement('script');
    oScript.type = 'text/javascript';
    oScript.src = sScriptSrc;
    oHead.appendChild(oScript);
};


function murkCloseGraceful() {
    jQuery('.l-sidebar-right').animate({'paddingTop':0},500);
    jQuery('#murkconsole').animate({'height':0,'paddingTop':0,'paddingBottom':0},500).fadeOut(1,function() { jQuery('body #murkconsole, #nssc-script').remove(); });
}

function murkMinimize(el) {
    jQuery('.l-sidebar-right').animate({'paddingTop':40},500);
    jQuery('#murkconsole').css('overflowY','hidden');
    jQuery('#murkconsole').animate({'height':40},500);
    jQuery(el).attr('onclick',"murkMaximize(this);return false;");
}

function murkMaximize(el) {
    jQuery('.l-sidebar-right').animate({'paddingTop':murkConsoleHeight},500);
    jQuery('#murkconsole').css('overflowY','auto');
    jQuery('#murkconsole').animate({'height':murkConsoleHeight},500);
    jQuery(el).attr('onclick',"murkMinimize(this);return false;");
}

function scrollWindowUpBitch() {
    window.scrollTo(0,0);
}


function trackKiller() {
    var eldone = false,
    theel = false,
    np = jQuery('div.waveform.playing').length;
    jQuery('li.soundList__item').each(function() {
        if (np && !eldone) {
            if (jQuery(this).find('div.waveform.playing').length) {
                eldone = true;
                theel = jQuery(this).find('div[role="group"]').attr('aria-label');
            }
        }
        else if (!eldone) {
            if (isElementInViewport(jQuery(this).next())) {
                eldone = true;
                theel = jQuery(this).find('div[role="group"]').attr('aria-label');
            }
        }
    });
    eldone = false;
    jQuery('li.soundList__item').each(function() {
        if (!eldone) {
            if ( jQuery(this).find('div[role="group"]').attr('aria-label') === theel) {
                eldone = true;
                scrollWindowUpBitch();
            }
        }
        if (!eldone) {
            jQuery(this).remove();
        }
    });
}

function ssmPlayNext() {
  var np = jQuery('div.waveform.playing').length;
  if (np) {
    np = jQuery('div.waveform.playing');
    np = np.closest("li");
    var nextTrack = jQuery(np).nextAll('li:visible').first(),
    // clickTarget = jQuery(nextTrack).find(".waveform .waveform__layer canvas:last"),
    clickTarget = jQuery(nextTrack).find(".playButton"),
    npoffset = jQuery(clickTarget).offset();


    npoffset.left -= 20;
    npoffset.top -= 64;

    clickTarget[0].click();

    jQuery('html, body').animate({
        scrollTop: npoffset.top,
        scrollLeft: npoffset.left
    });


  }
}

function fixMurk() {
    // Full convoluted bullshit

    var windowpos = jQuery(window).scrollTop(),
    s = jQuery("#murkconsole"),
    pos = s.position(),
    spos = jQuery('.l-sidebar-right').offset(),
    sw = jQuery('.l-sidebar-right').width();
    if (windowpos  +46 >= pos.top) {
        s.css({'position':'fixed','left':spos.left,'top':46,'width':sw});
    } else {
        s.css({'position':'absolute','left':'0','top':-16,'width':'100%'});
    }
}

function startmurk() {
    if ((window.location.href === 'https://soundcloud.com/feed') || (window.location.href === 'https://soundcloud.com/feed/') || window.location.href.includes("sclayouttest.html") ) {
         jQuery(document).ready(function() {

            if (!jQuery('#murkconsole').length) {

                jQuery('.l-sidebar-right').animate({'paddingTop':murkConsoleHeight},500).prepend(ssmPanel);

                jQuery('#murkconsole').animate({'height':murkConsoleHeight},500,function() { window.alert("Hi kids. So Soundcloud have changed stuff in their API that breaks some of the great functionality in this panel. Not sure how to fix it yet. Sorry. BrainZ - 13/08/2021");});


                jQuery("ul.lazyLoadingList__list").bind("DOMNodeInserted",function(e) {
                    var element = e.target;
                    if (jQuery(element).hasClass('soundList__item')) {
                        totalMurkHandler();
                    }
                });

            }
            jQuery(window).scroll(function() {
                fixMurk();
            });

            jQuery(window).resize(function() {
                fixMurk();
            });

        });
    } else {
        ssmPanel.innerHTML = deadoutconsole;
        jQuery('body').append(ssmPanel);
        murkCloseGraceful();
    }
}

if(!window.jQuery) {
   window.gmloadScript(jqsrc);
   window.onjQueryAvailable(startmurk);
} else {
   startmurk();
}
