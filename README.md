Sheet Music Database Website

Here are some instructions for how to update the code to do some common things.

-Adding a .pug page
If you just make the .pug, you won't be able to go to the page. To tell the server what to do when you access a page, add a line to the "Endpoints for views" section at the start of the app.js file. It should go something like:

app.get('/WhatYouWantTheLinkToBe', checkForLogin, (req, res) => res.render('NameOfFile'));

This code tells the server that whenever a user accesses "localhost/WhatYouWantTheLinkToBe", it should first check if they're logged in (the checkForLogin function automatically redirects them to /login if they aren't logged in) and then send them the formatted file "NameOfFile.pug". Note that you don't need to include the ".pug" part in the code. Also make sure that the .pug file is in the views directory or it won't be able to find it.

You can also make multiple URLs send you to the same page. You can do that by putting an array of endpoints instead of just one:

app.get(['/URL1', '/URL2], checkForLogin, (req, res) => res.render('NameOfFile'));

-How to do ___ in pug
There are existing pages in the views directory that you can look through to get the gist. For more detailed questions, they have documentation at pugjs.org. You can use any HTML (although the syntax is slightly more compact and has meaningful whitespace!) and it allows for some other things like reading things sent from the server. Incidentally, if you want to send things from the server, you'll have to write more complex code; the attemptLogin function is a good example of doing this. To make your page call that function, replace res.render('NameOfFile') with a call to your function.