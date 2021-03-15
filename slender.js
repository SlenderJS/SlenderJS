/**
 * SlenderJS - An open source JS Routing and Rendering library.
 * TwistPHP [ twistphp.com ]
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * @version		1.0.0
 * @author		Dan Walker, James Durham
 * @license		https://www.gnu.org/licenses/gpl.html GPL License
 * @link		https://github.com/TwistPHP/SlenderJS
 */
(function (root, window, document, factory) {
	if (typeof define === 'function' && define.amd) {
		define(factory(window, document));
	} else if (typeof exports === 'object') {
		module.exports = factory(window, document);
	} else {
		root.SlenderJS = factory(window, document);
	}
})(this, window, document, function(window, document){
	'use strict';

	function init(options){

		//Generic data storage
		this.data = {};

		//Define the options for the sub libraries
		options.hooks = options.render || [];
		options.render = options.render || [];
		options.router = options.router || [];

		//Load in the global functions (attach them to this)
		new SlenderGlobals(this);

		this.func = {};
		this.func.data = this.data;
		new SlenderHooks(options.hooks,this);
		new SlenderRender(options.render,this);
		new SlenderRouter(options.router,this);

		//Create the global instance of the library
		window.SlenderJS = this.func;
	}

	/**
	 * SlenderJS :: Hooks
	 * All the SlenderJS engine to be expandable
	 * @param options
	 * @param $
	 * @constructor
	 */
	function SlenderHooks(options,$){

		//Set all the functions that are publicly accessible
		$.func.hooks = {
			all: all,
			get: get,
			register: register,
			cancel: cancel,
			fire: fire
		};

		//Merge the defaults, options an new data
		options = {
			...{
				hooks: [],
			},
			...options
		};

		function all(library){
			return (library in options.hooks) ? options.hooks[library] : [];
		}

		function get(library,hook){
			return (library in options.hooks && hook in options.hooks[library]) ? options.hooks[library][hook] : null;
		}

		function register(library,hook,data){

			if(!(library in options.hooks)){
				options.hooks[library] = [];
			}

			options.hooks[library][hook] = data;
		}

		function cancel(library,hook){

			if(library in options.hooks){
				let index = options.hooks[library].indexOf(hook);
				if(index > -1){
					options.hooks[library].splice(index, 1);
				}
			}
		}

		function fire(library,args,specificHook){

			if(specificHook){
				let data = get(library,specificHook);
				return (data && typeof data === 'function') ? callFunction(data,args) : data;
			}else{
				let hooks = all(library);
				for(let hook in hooks){
					if(hooks.hasOwnProperty(hook)){
						callFunction(hooks[hook],args);
					}
				}
			}

			return false;
		}

		function callFunction(callback,args){
			return callback.call($, ...args);
		}
	}

	/**
	 * SlenderJS :: Render
	 * function to process View templates in the same format as TwistPHP::View()
	 * @param options
	 * @param $
	 * @constructor
	 */
	function SlenderRender(options,$){

		//Set all the functions that are publicly accessible
		$.func.render = {
			build: build,
			buildRaw: buildRaw,
			addTemplate: addTemplate
		};

		//Merge the defaults, options an new data
		options = {
			...{
				templates: [],
				viewParams: [],
				currentTag: null
			},
			...options
		};

		function build(template,templateData){

			let rawHTML = 'Error: Template "'+template+'" not found';

			if(template in options.templates){
				rawHTML = buildRaw(options.templates[template],templateData);
			}

			return rawHTML;
		}

		function buildRaw(rawHTML,templateData){

			let tags = getTags(rawHTML);
			if(tags.length > 0){
				//We have tags, process them
				for(let i=0; i<tags.length; i++){
					rawHTML = processTag(rawHTML,tags[i],templateData)
				}
			}

			return rawHTML;
		}

		function addTemplate(strTemplateName,strHTML){
			options.templates[strTemplateName] = strHTML;
			$.func.hooks.fire('render_add_template',[ strTemplateName, strHTML ]);
		}

		function getTags(template){
			let tags = $.preg_match_all(/{([^{}]+)}/gi,template);
			//Check their is an array of tags before returning them
			if(tags.length > 1){
				return tags[1];
			}
			return [];
		}

		function processTag(rawHTML,tag,arrData){
			if(tag.includes(':')){

				//Step 1 - Check to see if this is a conditional tag
				let arrItems = $.preg_match(/^([^?]+)\?([\w\W]+\:[\w\W]+)$/,tag);

				if(arrItems && arrItems.length){

					//Step 2 - Match the Conditions with parenthesis and option type matching
					let arrConditions = $.preg_match_all(/(\)|\()?([\w\d\:\-\_\.\'\"\[\]\/]+)([\=\!]{3}|[=\>\<\*\^\!\$]{2}|[\<\>\*]{1})([\w\d\s\:\-\_\.\'\"\/]+)(\)|\()?(&&|\|\|)?/gi,arrItems[1]);

					if(arrConditions.length > 1){

						let arrResults = [];
						let strParenthesisOpen = false,strParenthesisClose = false;
						let blParenthesisResult = true;
						let intResultPointer = 0;
						let strPreviousConditions = '',strPreviousParenthesisConditions = '';

						let strTempTag1 = '';
						let strTempTag2 = '';

						//Go through each condition one by one
						for(let intKey=0; intKey < arrConditions[1].length; intKey++){
							let strValue = arrConditions[1][intKey];

							//Detect opening parenthesis
							strParenthesisOpen = (!strParenthesisOpen && strValue === '(') ? true : strParenthesisOpen;

							//Get the two values to be compared
							//This functionality could be made much more efficient in a future release
							let arrValue1Parts = (arrConditions[2][intKey].includes(':')) ? arrConditions[2][intKey].split(':') : null;
							let arrValue2Parts = (arrConditions[4][intKey].includes(':')) ? arrConditions[4][intKey].split(':') : null;

							let strTempReplace1 = '',strTempReplace2 = '';

							//Build the data to correctly decode each tag in condition 1
							if(!$.isEmpty(arrValue1Parts)){
								strTempTag1 = '{'+arrConditions[2][intKey]+'}';
								strTempReplace1 = arrConditions[2][intKey];

							}

							//Build the data to correctly decode each tag in condition 2
							if(!$.isEmpty(arrValue2Parts)){
								strTempTag2 = '{'+arrConditions[4][intKey]+'}';
								strTempReplace2 = arrConditions[4][intKey];
							}

							let mxdValue1 = (!$.isEmpty(arrValue1Parts)) ? runTags(strTempTag1,strTempReplace1,arrValue1Parts[0],arrValue1Parts[1],arrData,true) : arrConditions[2][intKey];
							let mxdValue2 = (!$.isEmpty(arrValue2Parts)) ? runTags(strTempTag2,strTempReplace2,arrValue2Parts[0],arrValue2Parts[1],arrData,true) : arrConditions[4][intKey];

							//Detect undefined parameters and match against 'undefined'
							mxdValue1 = (mxdValue1 === strTempTag1) ? 'twst-undefined-variable' : mxdValue1;
							mxdValue2 = (mxdValue2 === strTempTag2) ? 'twst-undefined-variable' : mxdValue2;

							//Test the values with the condition
							let blResult = condition(mxdValue1,arrConditions[3][intKey],mxdValue2);

							//Detect closing parenthesis
							strParenthesisClose = (arrConditions[5][intKey] === ')');

							//If the current parenthesis result is true and previous parenthesis condition is && or ''
							//or If the current parenthesis result is false and the previous condition is OR Log Results
							//or If not in parenthesis send result through
							if(($.inArray(strPreviousParenthesisConditions,['&&','']) && blParenthesisResult )
								|| ( strPreviousParenthesisConditions === '||' && !blParenthesisResult )
								|| ( strParenthesisOpen === false && blParenthesisResult )){

								blParenthesisResult = blResult;
							}

							//If the parenthesis is not open or has opened and closed then log the result and rest vars
							if(strParenthesisOpen === false || (strParenthesisOpen && strParenthesisClose)){

								if($.inArray(strPreviousConditions,['&&','']) && (!(intResultPointer in arrResults) || arrResults[intResultPointer] === true)){
									arrResults[intResultPointer] = blParenthesisResult;
								}else if(strPreviousConditions === '||'){
									intResultPointer++;
									arrResults[intResultPointer] = blParenthesisResult;
								}

								strParenthesisOpen = strParenthesisClose = false;
								blParenthesisResult = true;
								strPreviousParenthesisConditions = '';
							}

							//Set the previous condition
							if(strParenthesisOpen){
								strPreviousParenthesisConditions = arrConditions[6][intKey];
							}else{
								strPreviousConditions = arrConditions[6][intKey];
							}
						}

						//Run through the results and see if conditions have been met
						let blOut = false;
						for(let i=0; i < arrResults.length; i++){
							blOut = (arrResults[i]) ? true : blOut;
						}

						//Step 4 - Grab the result parameters
						arrResults = $.preg_match_all(/(\'([^\']*)\'|\"([^\"]*)\"|([\d]+)|([\w\.\-\_\/\[]+:[\w\.\_\-\/\]]+)):?/gi,arrItems[2]);

						if(arrResults[5][(blOut)?0:1] !== ''){
							let arrTagParts = arrResults[5][(blOut)?0:1].split(':');

							//Would crc32() be faster?
							let strHash = $.md5(rawHTML);
							rawHTML = runTags(rawHTML,tag,arrTagParts[0],arrTagParts[1],arrData);

							if(strHash === $.md5(rawHTML)){
								//Remove un-used tag as the statement has been matched
								rawHTML = replaceTag(rawHTML,tag,'');
							}
						}else{
							let intConditionResult = (blOut)?0:1;
							let strOut = '';
							if(!$.isEmpty(arrResults[2][intConditionResult])){
								strOut = arrResults[2][intConditionResult];
							}else if(!$.isEmpty(arrResults[3][intConditionResult])){
								strOut = arrResults[3][intConditionResult];
							}else if(!$.isEmpty(arrResults[4][intConditionResult])){
								strOut = arrResults[4][intConditionResult];
							}

							rawHTML = replaceTag(rawHTML,tag,strOut);
						}
					}
				}else{
					//Its a non conditional tag, run it here
					let tagParts = tag.split(':');
					let type = tagParts[0];
					tagParts.splice(0,1);
					let reference = tagParts.join(':');

					rawHTML = runTags(rawHTML,tag,type,reference,arrData);
				}
			}
			return rawHTML;
		}

		function runTags(rawHTML,strTag,strType,strReference,arrData,blReturnArray){

			blReturnArray = blReturnArray || false;

			let strFunction = '';
			let arrMatchResults = [];
			let strTagData = '';
			options.currentTag = strTag;

			if(strType.includes('[') && strReference.includes(']')){

				let arrFunctionParts = strType.split('[');
				strFunction = arrFunctionParts[0];
				strType = arrFunctionParts[1];
				strReference = strReference.replace(/\]$/gi,'');

			}else if(arrMatchResults = $.preg_match(/(.*)\[(.*)\:(.*)\]/ig,strTag)){

				strFunction = arrMatchResults[1];
				strType = arrMatchResults[2];
				strReference = arrMatchResults[3];
			}

			//Get the parameters from the tag, as we cant pass by reference will return updates strReference
			let arrParameters = extractParameters(strReference,arrData);
			strReference = arrParameters[0];
			arrParameters = arrParameters[1];

			let blRemoveTags = ('remove-tags' in arrParameters && arrParameters['remove-tags'] === true);
			let blProcessTags = (!('process-tags' in arrParameters && arrParameters['process-tags'] === false));

			switch(strType){
				case'data':
					//The tag is looking for data to be returned
					let results = processArrayItem(strReference, arrData, blReturnArray);
					if(results.status === true){
						rawHTML = replaceTag(rawHTML, strTag, results.return, strFunction, results.return_raw, arrParameters);
					}
					break;

				case'view':

					options.viewParams = arrParameters;
					arrData = typeof(arrData) == 'object' ? [arrData,...arrParameters] : arrParameters;

					strTagData = build(strReference,arrData,blRemoveTags,blProcessTags);
					rawHTML = replaceTag(rawHTML,strTag,strTagData,strFunction,[],arrParameters);

					break;

				case'repeater':

					options.viewParams = arrParameters;
					//arrData = typeof(arrData) == 'object' ? [arrData,...arrParameters] : arrParameters;

					if(!$.isEmpty(arrParameters['view']) && strReference in arrData && arrData[strReference].length){

						//Allow the original data to be accessed via parent
						$.func.hooks.register('render_tags','parent',arrData);

						for(let i=0; i < arrData[strReference].length; i++){
							strTagData += build(arrParameters['view'],arrData[strReference][i],blRemoveTags,blProcessTags);
						}

						//Remove the original parent data tag
						$.func.hooks.cancel('render_tags','parent');
					}

					rawHTML = replaceTag(rawHTML,strTag,strTagData,strFunction,[],arrParameters);
					break;

				default:

					let strReplacementData = $.func.hooks.fire('render_tags',[ strReference, arrData, arrParameters ],strType)
					if(!$.isEmpty(strReplacementData)){

						//An array of data has been returned, this is data tags
						if(typeof strReplacementData === 'object'){
							strReplacementData = processArrayItem(strReference,mxdExtensions,blReturnArray)
						}

						rawHTML = replaceTag(rawHTML,strTag,strReplacementData,strFunction,[],arrParameters);
					}

					break;
			}

			return rawHTML;
		}

		function processArrayItem(strKey,arrData,blReturnArray){

			blReturnArray = blReturnArray || false;
			//Find an item within an array of data, return the round status and the return value.

			let result = {status: false,return: '',return_raw: ''};

			if(typeof(arrData) == 'object'){

				if(strKey.includes('/')){

					let mxdTempData = '';
					//$mxdTempData = \Twist::framework()->tools()->arrayParse($strKey,$arrData);

					result.status = !$.isEmpty($mxdTempData);
					result.return = (typeof(arrData[strKey]) == 'object' && blReturnArray === false) ? JSON.stringify(mxdTempData, null, 4) : mxdTempData;
					result.return_raw = mxdTempData;

					//Do what normally happens
				}else if(strKey in arrData){

					result.status = true;
					result.return = (typeof(arrData[strKey]) == 'object' && blReturnArray === false) ? JSON.stringify(arrData[strKey], null, 4) : arrData[strKey];
					result.return_raw = arrData[strKey];
				}
			}

			return result;
		}

		function replaceTag(rawHTML, tag, returndata, strFunction, return_raw, parameters){
			return rawHTML.replace('{'+tag+'}',returndata);
		}

		function condition(mxdValue1,strCondition,mxdValue2){

			let blOut = false;

			//Sanitise and detect type of each variable
			mxdValue1 = detectType(mxdValue1);
			mxdValue2 = detectType(mxdValue2);

			switch(strCondition){
				case'===':
					blOut = (mxdValue1 === mxdValue2);
					break;
				case'!==':
					blOut = (mxdValue1 !== mxdValue2);
					break;
				case'==':
					blOut = (mxdValue1 == mxdValue2 || (mxdValue1 == '' && mxdValue2 === 'twst-undefined-variable') || (mxdValue2 == '' && mxdValue1 === 'twst-undefined-variable'));
					break;
				case'<':
					blOut = (mxdValue1 < mxdValue2);
					break;
				case'>':
					blOut = (mxdValue1 > mxdValue2);
					break;
				case'<=':
					blOut = (mxdValue1 <= mxdValue2);
					break;
				case'>=':
					blOut = (mxdValue1 >= mxdValue2);
					break;
				case'!=':
					blOut = (mxdValue1 != mxdValue2);
					break;
				case'*':
					blOut = $.inArray(mxdValue2,mxdValue1);
					break;
				case'^=':
					blOut = (mxdValue1.substr(0, mxdValue2.length) == mxdValue2);
					break;
				case'*=':
					blOut = (mxdValue1.indexOf(mxdValue2));
					break;
				case'=':
					blOut = (mxdValue1.substr((mxdValue1.length-mxdValue2.length),mxdValue2.length) == mxdValue2);
					break;
			}

			return blOut;
		}

		function detectType(mxdValue){

			//Detect and correct the type of the inputs contents
			if(typeof(mxdValue) !== 'boolean' && typeof(mxdValue) !== 'object'){

				//Get the length of the original string and strip containing quote marks
				let intLength = mxdValue.length;

				//Clean the string up
				mxdValue = (mxdValue === "''" || mxdValue === '""') ? '' : mxdValue;
				mxdValue = $.preg_replace(/^([\'|\"]{1})([\W\w]+)([\'|\"]{1})/ig, '$2', mxdValue);

				//If the length has stayed the same it is not a string and type needs correcting
				let blDetect = (intLength === mxdValue.length);

				if(blDetect && mxdValue === 'null'){
					mxdValue = null;
				}else if(blDetect && mxdValue === 'undefined'){
					mxdValue = 'twst-undefined-variable';
				}else if(blDetect && mxdValue === 'true'){
					mxdValue = true;
				}else if(blDetect && mxdValue === 'false'){
					mxdValue = false;
				}else if(blDetect && $.preg_match(/^[0-9]+\.[0-9]+/ig,mxdValue)){
					mxdValue = parseFloat(mxdValue);
				}else if(blDetect && typeof(mxdValue) === 'number'){
					mxdValue = parseInt(mxdValue);
				}
			}

			return mxdValue;
		}

		function extractParameters(strReference,arrData){

			arrData = arrData || [];

			//Explode parameters they must be set as key=value pairs comma separated. To pass a unassociated array in the values split by  pipe symbol '|'
			let arrParameters = [];
			let arrReferenceParams = $.csvToArray(strReference,',')[0];

			if(arrReferenceParams.length){
				strReference = arrReferenceParams[0];
				arrReferenceParams.splice(0,1);

				for(let intKey=0; intKey < arrReferenceParams.length; intKey++){
					let mxdItem = arrReferenceParams[intKey];

					if(mxdItem.includes('=')){
						let parameter = mxdItem.split('=');
						let strKey = parameter[0];
						let mxdValue = parameter[1];

						if(mxdValue.includes(':')){
							let arrParamTagParts = mxdValue.split(':');
							if(arrParamTagParts.length === 2){
								//A tag should only have 2 parts, only process is there are 2 parts (no more, no less)
								mxdValue = runTags('{'+mxdValue+'}',mxdValue,arrParamTagParts[0],arrParamTagParts[1],arrData);
							}
						}

						mxdValue = detectType(mxdValue);
						arrParameters[strKey] = (mxdValue.includes('|')) ? mxdValue.split('|') : mxdValue;
					}else if(mxdItem.includes('|')){
						mxdItem = detectType(mxdItem);
						arrParameters.push((mxdItem.includes('|')) ? mxdItem.split('|') : mxdItem);
					}else{
						mxdItem = detectType(mxdItem);
						arrParameters[mxdItem] = true;
					}
				}
			}

			return [strReference,arrParameters];
		}
	}

	/**
	 * SlenderJS :: Router
	 * function to process routing in the browser, inspired by VueJS and TwistPHP::Route()
	 * @param options
	 * @param $
	 * @constructor
	 */
	function SlenderRouter(options,$){

		//Set all the functions that are publicly accessible
		$.func.router = {
			start: start,
			page: renderPage,
			addRoute: addRoute
		};

		//Ensure we have empty arrays for key defaults
		options.transition = options.transition || 'default';
		options.meta = options.meta || [];
		options.domains = options.domains || [];
		options.routes = options.routes || [];

		//Merge the defaults, options an new data, we are doing a multi-level merge here
		options = {
			transition: options.transition,
			domains: options.domains,
			meta: {
				...[
					{ charset: "UTF-8" },
					{ name: "viewport", content: "width=device-width, user-scalable=no, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0" },
					{ "http-equiv": "X-UA-Compatible", content: "ie=edge" },
				],
				...options.meta
			},
			routes: {
				...{
					"404": {
						title: 'Page Not Found',
						template: '404.tpl'
					},
					"403": {
						title: 'Permission Denied',
						template: '403.tpl'
					}
				},
				...options.routes
			}
		}

		registerListeners();

		function start(){

			//Register the default page transition (Switch directly to the page, no animation)
			$.func.hooks.register('router_page_transition','default',function(urlPath, pageTitle, pageBody, pageInfo){
				document.body.innerHTML = pageBody;
			})

			//Add the default/site wide meta tags to the header
			generateMetaData(options.meta,false);

			//Render the landing page
			renderPage(window.location.pathname);
		}

		function addRoute(path,route){
			options.routes[path] = route;
			$.func.hooks.fire('router_add_route',[ path, route ]);
		}

		function renderPage(path){

			//Set the default page as 404, use "var" so that we can pass by REF in the hooks
			var routerCurrent = options.routes['404'];

			if(path in options.routes){
				routerCurrent = options.routes[path];
			}

			//Ensure that all the defaults are configured
			routerCurrent.title = routerCurrent.title || '';
			routerCurrent.template = routerCurrent.template || '';
			routerCurrent.data = routerCurrent.data || [];
			routerCurrent.meta = routerCurrent.meta || [];
			routerCurrent.preventLoad = false;

			//Fire the render page hooks
			$.func.hooks.fire('router_render_page',[ path, routerCurrent ]);

			if(!routerCurrent.preventLoad){
				//Render the page and header, display the page using push states
				pushState(path,routerCurrent.title,renderPageBody(path, routerCurrent),routerCurrent);
			}

			//Reset the value
			routerCurrent.preventLoad = false;
		}

		function renderPageBody(path, route){

			//Fire the render page body hooks
			$.func.hooks.fire('router_page_body',[ path, route ]);

			return $.func.render.build(route.template,route.data);
		}

		function renderPageHead(pageInfo){

			//Set the meta title
			let metaTitle = document.querySelector('head title');
			metaTitle.innerHTML = pageInfo.title;

			generateMetaData(pageInfo.meta,true);

			//Fire the render page body hooks
			$.func.hooks.fire('router_page_head',[ pageInfo ]);

			return '';
		}

		function generateMetaData(meta,blRemovableMeta){

			meta = meta || [];
			blRemovableMeta = blRemovableMeta || false;

			if(blRemovableMeta){
				//Remove all meta data associated with last page
				document.querySelectorAll('[data-smart-meta]').forEach(function(elm,index){
					elm.remove();
				})
			}

			if(meta.length){

				//Removable meta goes after title, static meta goes before title
				let metaInsertBeforeElement = (blRemovableMeta) ? document.querySelector('head title').nextSibling : document.querySelector('head title');

				//Go though all the meta tags and generate/add them
				for(let i = 0; i < meta.length; i++){

					let tag = document.createElement('meta');
					Object.keys(meta[i]).forEach(key => {
						tag.setAttribute(key, meta[i][key]);
					});

					if(blRemovableMeta){
						tag.setAttribute('data-smart-meta', '');
					}

					document.querySelector('head').insertBefore(tag, metaInsertBeforeElement);
				}
			}
		}

		function pushState(urlPath, pageTitle, pageBody, pageInfo){

			$.func.hooks.fire('router_page_transition',[ urlPath, pageTitle, pageBody, pageInfo ],options.transition);

			document.title = pageTitle;
			renderPageHead(pageInfo);

			window.history.pushState({
				"pageBody":pageBody,
				"pageTitle":pageTitle,
				"pageInfo":pageInfo,
			},pageTitle, urlPath);
		}

		function registerListeners(){

			window.onpopstate = function(e){
				if(e.state){
					document.title = e.state.pageTitle;
					document.body.innerHTML = e.state.pageBody;
					renderPageHead(e.state.pageInfo);
				}
			};

			window.addEventListener('click', function(e){

				let url = null;
				if(e.target.matches('a')){
					url = e.target.getAttribute('href');
				}else if(e.target.matches('[data-smart-route]')){
					url = e.target.getAttribute('data-smart-route');
				}

				if(url){
					let urlData = $.parseUri(url);
					if(url && (url.startsWith('/') || $.inArray(urlData.hostname,options.domains))){
						e.preventDefault();
						renderPage(urlData.pathname);
					}
				}
			});
		}
	}

	/**
	 * SlenderJS :: Globals
	 * A library of handy functions that are attached the this ($)
	 * Accessible via $ in the sub library's
	 * @param $
	 * @constructor
	 */
	function SlenderGlobals($){

		$.inArray = function(item,arrData){
			return (arrData.length && arrData.indexOf(item) > -1);
		}

		$.isEmpty = function(val){
			return (val === undefined || val == null || val.length <= 0);
		}

		$.preg_replace = function(pattern,replacement,data){
			return data.replace(pattern,replacement);
		}

		$.preg_match = function(pattern,data){
			return pattern.exec(data);
		}

		$.preg_match_all = function(pattern,data){
			//Generate the same output that PHP preg_match_all provides
			let matches = [];
			let matchedData = [...data.matchAll(pattern)];
			for(let i = 0;i<matchedData.length; i++){
				let subMatches = [...matchedData[i]];
				for(let ii = 0;ii<subMatches.length; ii++){
					if(!(ii in matches)){
						matches[ii] = [];
					}
					matches[ii].push(subMatches[ii]);
				}
			}
			return matches;
		}

		/**
		 * See: https://gist.github.com/1847816
		 */
		$.parseUri = function(url){

			var result = {};

			var anchor = document.createElement('a');
			anchor.href = url;

			var keys = 'protocol hostname host pathname port search hash href'.split(' ');
			for (var keyIndex in keys) {
				var currentKey = keys[keyIndex];
				result[currentKey] = anchor[currentKey];
			}

			result.toString = function() { return anchor.href; };
			result.requestUri = result.pathname + result.search;
			return result;
		}

		/**
		 * See: https://gist.github.com/Jezternz/c8e9fafc2c114e079829974e3764db75
		 */
		$.csvToArray = function(data,delim){
			// https://gist.github.com/Jezternz/c8e9fafc2c114e079829974e3764db75
			delim = delim || ',';
			const re = /(,|\r?\n|\r|^)(?:"([^"]*(?:""[^"]*)*)"|([^,\r\n]*))/gi
			const result = [[]]
			let matches
			while ((matches = re.exec(data))) {
				if (matches[1].length && matches[1] !== delim) result.push([])
				result[result.length - 1].push(
					matches[2] !== undefined ? matches[2].replace(/""/g, '"') : matches[3]
				)
			}
			return result
		}

		/**
		 * See: https://stackoverflow.com/questions/1655769/fastest-md5-implementation-in-javascript
		 * A formatted version of a popular md5 implementation.
		 * Original copyright (c) Paul Johnston & Greg Holt.
		 * The function itself is now 42 lines long.
		 */
		$.md5 = function(inputString){
			var hc="0123456789abcdef";
			function rh(n) {var j,s="";for(j=0;j<=3;j++) s+=hc.charAt((n>>(j*8+4))&0x0F)+hc.charAt((n>>(j*8))&0x0F);return s;}
			function ad(x,y) {var l=(x&0xFFFF)+(y&0xFFFF);var m=(x>>16)+(y>>16)+(l>>16);return (m<<16)|(l&0xFFFF);}
			function rl(n,c)            {return (n<<c)|(n>>>(32-c));}
			function cm(q,a,b,x,s,t)    {return ad(rl(ad(ad(a,q),ad(x,t)),s),b);}
			function ff(a,b,c,d,x,s,t)  {return cm((b&c)|((~b)&d),a,b,x,s,t);}
			function gg(a,b,c,d,x,s,t)  {return cm((b&d)|(c&(~d)),a,b,x,s,t);}
			function hh(a,b,c,d,x,s,t)  {return cm(b^c^d,a,b,x,s,t);}
			function ii(a,b,c,d,x,s,t)  {return cm(c^(b|(~d)),a,b,x,s,t);}
			function sb(x) {
				var i;var nblk=((x.length+8)>>6)+1;var blks=new Array(nblk*16);for(i=0;i<nblk*16;i++) blks[i]=0;
				for(i=0;i<x.length;i++) blks[i>>2]|=x.charCodeAt(i)<<((i%4)*8);
				blks[i>>2]|=0x80<<((i%4)*8);blks[nblk*16-2]=x.length*8;return blks;
			}
			var i,x=sb(inputString),a=1732584193,b=-271733879,c=-1732584194,d=271733878,olda,oldb,oldc,oldd;
			for(i=0;i<x.length;i+=16) {olda=a;oldb=b;oldc=c;oldd=d;
				a=ff(a,b,c,d,x[i+ 0], 7, -680876936);d=ff(d,a,b,c,x[i+ 1],12, -389564586);c=ff(c,d,a,b,x[i+ 2],17,  606105819);
				b=ff(b,c,d,a,x[i+ 3],22,-1044525330);a=ff(a,b,c,d,x[i+ 4], 7, -176418897);d=ff(d,a,b,c,x[i+ 5],12, 1200080426);
				c=ff(c,d,a,b,x[i+ 6],17,-1473231341);b=ff(b,c,d,a,x[i+ 7],22,  -45705983);a=ff(a,b,c,d,x[i+ 8], 7, 1770035416);
				d=ff(d,a,b,c,x[i+ 9],12,-1958414417);c=ff(c,d,a,b,x[i+10],17,     -42063);b=ff(b,c,d,a,x[i+11],22,-1990404162);
				a=ff(a,b,c,d,x[i+12], 7, 1804603682);d=ff(d,a,b,c,x[i+13],12,  -40341101);c=ff(c,d,a,b,x[i+14],17,-1502002290);
				b=ff(b,c,d,a,x[i+15],22, 1236535329);a=gg(a,b,c,d,x[i+ 1], 5, -165796510);d=gg(d,a,b,c,x[i+ 6], 9,-1069501632);
				c=gg(c,d,a,b,x[i+11],14,  643717713);b=gg(b,c,d,a,x[i+ 0],20, -373897302);a=gg(a,b,c,d,x[i+ 5], 5, -701558691);
				d=gg(d,a,b,c,x[i+10], 9,   38016083);c=gg(c,d,a,b,x[i+15],14, -660478335);b=gg(b,c,d,a,x[i+ 4],20, -405537848);
				a=gg(a,b,c,d,x[i+ 9], 5,  568446438);d=gg(d,a,b,c,x[i+14], 9,-1019803690);c=gg(c,d,a,b,x[i+ 3],14, -187363961);
				b=gg(b,c,d,a,x[i+ 8],20, 1163531501);a=gg(a,b,c,d,x[i+13], 5,-1444681467);d=gg(d,a,b,c,x[i+ 2], 9,  -51403784);
				c=gg(c,d,a,b,x[i+ 7],14, 1735328473);b=gg(b,c,d,a,x[i+12],20,-1926607734);a=hh(a,b,c,d,x[i+ 5], 4,    -378558);
				d=hh(d,a,b,c,x[i+ 8],11,-2022574463);c=hh(c,d,a,b,x[i+11],16, 1839030562);b=hh(b,c,d,a,x[i+14],23,  -35309556);
				a=hh(a,b,c,d,x[i+ 1], 4,-1530992060);d=hh(d,a,b,c,x[i+ 4],11, 1272893353);c=hh(c,d,a,b,x[i+ 7],16, -155497632);
				b=hh(b,c,d,a,x[i+10],23,-1094730640);a=hh(a,b,c,d,x[i+13], 4,  681279174);d=hh(d,a,b,c,x[i+ 0],11, -358537222);
				c=hh(c,d,a,b,x[i+ 3],16, -722521979);b=hh(b,c,d,a,x[i+ 6],23,   76029189);a=hh(a,b,c,d,x[i+ 9], 4, -640364487);
				d=hh(d,a,b,c,x[i+12],11, -421815835);c=hh(c,d,a,b,x[i+15],16,  530742520);b=hh(b,c,d,a,x[i+ 2],23, -995338651);
				a=ii(a,b,c,d,x[i+ 0], 6, -198630844);d=ii(d,a,b,c,x[i+ 7],10, 1126891415);c=ii(c,d,a,b,x[i+14],15,-1416354905);
				b=ii(b,c,d,a,x[i+ 5],21,  -57434055);a=ii(a,b,c,d,x[i+12], 6, 1700485571);d=ii(d,a,b,c,x[i+ 3],10,-1894986606);
				c=ii(c,d,a,b,x[i+10],15,   -1051523);b=ii(b,c,d,a,x[i+ 1],21,-2054922799);a=ii(a,b,c,d,x[i+ 8], 6, 1873313359);
				d=ii(d,a,b,c,x[i+15],10,  -30611744);c=ii(c,d,a,b,x[i+ 6],15,-1560198380);b=ii(b,c,d,a,x[i+13],21, 1309151649);
				a=ii(a,b,c,d,x[i+ 4], 6, -145523070);d=ii(d,a,b,c,x[i+11],10,-1120210379);c=ii(c,d,a,b,x[i+ 2],15,  718787259);
				b=ii(b,c,d,a,x[i+ 9],21, -343485551);a=ad(a,olda);b=ad(b,oldb);c=ad(c,oldc);d=ad(d,oldd);
			}
			return rh(a)+rh(b)+rh(c)+rh(d);
		}
	}

	return init;
});