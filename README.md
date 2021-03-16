# SlenderJS

A JS library that can be a router for pages as well as rendering HTML templates on the client side. The library has been based upon the View and Route helpers from the TwistPHP framework and can process the TwistPHP View templates. Templating can be used on its own if routing is not required.

Simple to use, expandable and light weight!

## Getting Started

Download a copy of the library from the GIT repo and including it in the head of your **index.html** file.

`<script src='slender.min.js'></script>`

First off you will need to initialise the Slender engine by calling the following command

`new SlenderJS();`

Now you will be free to use SlenderJS anywhere in your code.

Enjoy!

Minified with: https://skalman.github.io/UglifyJS-online/


## Usage Guide

### Register a Template

Registering a HTML page template this can be done using the below comment.

```
SlenderJS.render.addTemplate('/page.tpl',
    '<h1>{data:title}</h1><p>{data:body}</p>'
);
```

For more information about templating please see the TwistPHP template example documentation.

### Register a Page

Registering a Page URL with some data that will be processed when the users visit the page

```
SlenderJS.router.addRoute('/',{
    title:'My Home Page',
    template:'/page.tpl',
    data:{
        title:'Welcome to my Home Page',
        body:'Have a look around my example page! Check out <a href="/second/page">My Second Page</a>'
    }
});

SlenderJS.router.addRoute('/second/page',{
    title:'My Secound Page',
    template:'/page.tpl',
    data:{
        title:'A Secound Page',
        body:'Some more info on my secound page!'
    }
});
```

When using routing you will need to have an `<div id="app"></div>` in your page body and call the start function upon page load, this will instruct the browser to start routing the pages and give it a place to output the page HTML.

`SlenderJS.router.start();`

Routing using virtual paths will require the use of .htaccess or equivalent depending on your server setup. Place the following code in your htaccess file.

```
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
    RewriteRule ^index.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
</IfModule>
```

### Rendering a Template

Using the templating system without routing or for another purpose can be achived using the below code.

```
let renderedHTML = SlenderJS.render.build('/page.tpl',{
    title:'Example Title Text',
    body:'Example body text'
});
```

Alternatively if you have a small bit of HTML you would like to render you can also do:

```
let renderedHTML = SlenderJS.render.buildRaw('<div id="{data:id}">{data:content}</div>',{
    id:'MyDiv1',
    content:'<p>Some Example Content</p>'
});
```

### Coming Soon

More documentation needs to be added here on how to expand the system with hooks, register multiple templates and routes at once as well as setting up page transitions.