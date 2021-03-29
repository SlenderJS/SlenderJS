# SlenderJS

![GitHub release](https://img.shields.io/github/release/SlenderJS/SlenderJS.svg)

A JS library that can be a router for pages as well as rendering HTML templates on the client side. The library has been based upon the View and Route helpers from the [TwistPHP Framework](https://github.com/TwistPHP/TwistPHP) and can process the TwistPHP View templates. Templating can be used on its own if routing is not required.

Simple to use, expandable and light weight!

## Getting Started

Download a copy of the library from the GIT repo and including it in the head of your **index.html** file.

`<script src='slender.min.js'></script>`

First off you will need to initialise the Slender engine by calling the following command

`new SlenderJS();`

Now you will be free to use SlenderJS anywhere in your code.

Enjoy!

Minified with: https://skalman.github.io/UglifyJS-online/

## Example Code

We have put together some [Example Code](https://github.com/SlenderJS/SlenderJS/tree/main/example), the code in the example closely follows our [Usage Guide](https://github.com/TwistPHP/SlenderJS#usage-guide). There is more information and code examples in the usages guide so be sure to read over it before you get start.

## Usage Guide

### Register a Template

Registering a HTML page template this can be done using the below comment.

```javascript
SlenderJS.render.addTemplate('/page.tpl',
    `<h1>{data:title}</h1><p>{data:body}</p>`
);
```

For more information about templating please see the TwistPHP template example documentation.

### Register a Page

Registering a Page URL with some data that will be processed when the users visit the page

```javascript
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

`start()` has two optional parameters that can be passed though

| Parameter                     | Type      | Purpose       |
| ----------------------------- | --------- | ------------- |
| blDOMContentLoaded            | Boolean   | true = Wait for all scripts and css to be loaded before processing the page (Default: false)
| startPath                     | String    | An optional start path which will override the current browser path i.e /login could be shown

Routing using virtual paths will require the use of .htaccess or equivalent depending on your server setup. Place the following code in your htaccess file.

```htaccess
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
    RewriteRule ^index.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
</IfModule>
```

### Page Specific Head Tags (Meta, Script, Style and Link)

You can set page specific meta tags as well as including scripts and style-sheets that will only be loaded on the current page.
To do this simply add the following details for each tag into the `addRoute()` function call as per below.

```javascript
SlenderJS.router.addRoute('/',{
    title:'My Home Page',
    template:'/page.tpl',
    data:{
        title:'Welcome to my Home Page',
        body:'Have a look around my example page! Check out <a href="/second/page">My Second Page</a>'
    },
    meta:[
        {name:"description",content:"This is my page description"},
        {name:"author",content:"SlenderJS"}
    ]
});
```
An example of adding some other types of tags can be seem below:

```
meta:[
    {name:"description",content:"This is my page description"},
    {name:"author",content:"SlenderJS"}
],
script:[
    {contents:`alert('Hello World!');`},
    {src:"https://ajax.googleapis.com/ajax/libs/threejs/r84/three.min.js"},
],
link:[
    {href:"https://ajax.googleapis.com/ajax/libs/threejs/r84/three.min.js"},
]
```

### Adding Redirect

Adding a redirect is simple. All you need is one line of code which is below. The first parameter is the path you want the redirect to happen on, the second parameter is where you want the redirect to go.

```javascript
SlenderJS.router.addRedirect('/home','https://example.com');
```

### Rendering a Template

Using the templating system without routing or for another purpose can be achived using the below code.

```javascript
let renderedHTML = SlenderJS.render.build('/page.tpl',{
    title:'Example Title Text',
    body:'Example body text'
});
```

Alternatively if you have a small bit of HTML you would like to render you can also do:

```javascript
let renderedHTML = SlenderJS.render.buildRaw('<div id="{data:id}">{data:content}</div>',{
    id:'MyDiv1',
    content:'<p>Some Example Content</p>'
});
```

### Choose a Page Transition

SlenderJS supports page transitions, the 'default' transition is to swap the old page for the new page, not animation, just plain and simple. We have included another option 'fade' which will fade out the old page and then fade in the new page.
To choose a page transition set the transition option when generating the SlenderJS instance.

`new SlenderJS({ transition: 'fade' });`

### Creating a Page Transition

You can also create your own page transitions, each transition should be registered under the 'router_page_transition' hook with a unique name.
For this example we are going to adapt a copy of the default fade transition making to take twice as long to animate. Copy the below code and set your transition to be `slowfade` to give it a try!

```javascript
SlenderJS.hooks.register('router_page_transition','slowfade',function(urlPath, pageTitle, pageBody, pageInfo){

    this.priv.router.createPageContainer(urlPath,pageBody);
    this.priv.router.generateTags('style',[{contents: '.slenderFadeIn{opacity: 1!important;} .slenderFadeOut{opacity: 0!important;}'}],true);

    //Set the opacity filters (1s out, 1s in)
    this.currentPage.style.opacity = '1';
    this.currentPage.style.transition = 'opacity 1s linear';
    this.nextPage.style.opacity = '0';
    this.nextPage.style.transition = 'opacity 1s linear 1s';
    
    //Start the animation
    this.nextPage.classList.remove('slenderPageNext','slenderPageHidden');
    this.nextPage.classList.add('slenderPageCurrent','slenderFadeIn');
    this.currentPage.classList.add('slenderFadeOut');

    setTimeout(function($){ $.currentPage.remove(); }, 990, this);
    setTimeout(function($){
    	$.currentPage = $.nextPage;
    	$.nextPage = null;
		//@important Page must be marked as ready!
		$.priv.router.pageReady();
	}, 1010, this);
});
```

⚠️ **Important**: you must call `$.priv.router.pageReady();` once your page has finished is transition process, using a timeout set to happen at the end of your transition is a good option

### Available Hooks

Hooks allow you to extend the SlenderJS library to add in new functionality without needing edit the code directly, you can create your own plugins or add support for other JS libraries.
Let us know if you have written a plugin or expansion that you wish to share with the community! 

| Hook Group                    | Area      | Params | Purpose       |
| ----------------------------- | --------- | ------ | ------------- |
| render_add_template           | Render    | 2      | A template is added to your instance
| render_tags                   | Render    | 0/4 ** | Adds support for a new template tag i.e. a unique key of 'test' will add support for the template tag `{test:somthing}`
| router_add_route              | Router    | 2      | A route has is added to your instance
| router_add_redirect           | Router    | 2      | A redirect is added to your instance
| router_page                   | Router    | 4      | Fired before the requested page is processed
| router_page_body              | Router    | 4      | Fired before the requested page body is processed
| router_page_head              | Router    | 4      | Fired before the requested page head is processed
| router_page_transition        | Router    | 4      | Handles the transition between pages, only one specific hook from this group will be fired upon page load `option: transition`.
| router_page_ready             | Router    | 1      | Fires after a page transition has been complete and the page is showing to the user
| router_page_domcontentloaded  | Router    | 2      | Fires after a page transition has been complete and all included scripts and stylesheets have been loaded

** Tags can be used as a function or by passing in an array of data

## Contributions & Support

This is an open-source library, if you find any bugs or have any suggestions please log an issue or create a pull request with your changes, We welcome your support!