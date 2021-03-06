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
 * @version		2.0.0
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

	function init(options,data){

		//Generic data storage
		this.data = data || {};

		//Store the startup options in global config
		this.conf = options || {};

		this.func = {};
		this.func.data = this.data;
		this.priv = {};

		new SlenderGlobals(this);
		new SlenderHooks(this);
		new SlenderRender(this);
		new SlenderRouter(this);

		//Return all the globals for public use if option globals is true
		if(this.conf.globals){
			this.func.globals = {
				arrayKeys:this.arrayKeys,
				inArray:this.inArray,
				arrayParse:this.arrayParse,
				isEmpty:this.isEmpty,
				closest:this.closest,
				preg_replace:this.preg_replace,
				preg_match:this.preg_match,
				preg_match_all:this.preg_match_all,
				parseUri:this.parseUri,
				parseQueryString:this.parseQueryString,
				csvToArray:this.csvToArray,
				md5:this.md5,
				date:this.date
			};
		}

		//Create the global instance of the library
		window.SlenderJS = this.func;
	}

	/**
	 * SlenderJS :: Hooks
	 * All the SlenderJS engine to be expandable
	 * @param $
	 * @constructor
	 */
	function SlenderHooks($){

		//Set all the functions that are publicly accessible
		$.func.hooks = {
			all: all,
			get: get,
			register: register,
			cancel: cancel,
			fire: fire
		};

		//Merge the defaults, options an new data
		$.conf.hooks = $.conf.hooks || [];

		function all(library){
			return (library in $.conf.hooks) ? $.conf.hooks[library] : [];
		}

		function get(library,hook){
			return (library in $.conf.hooks && hook in $.conf.hooks[library]) ? $.conf.hooks[library][hook] : null;
		}

		function register(library,hook,data){

			if(!(library in $.conf.hooks)){
				$.conf.hooks[library] = [];
			}

			$.conf.hooks[library][hook] = data;
		}

		function cancel(library,hook){

			if(library in $.conf.hooks){
				let index = $.conf.hooks[library].indexOf(hook);
				if(index > -1){
					$.conf.hooks[library].splice(index, 1);
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
	 * @param $
	 * @constructor
	 */
	function SlenderRender($){

		//Set all the functions that are publicly accessible
		$.func.render = {
			build: build,
			buildRaw: buildRaw,
			addTemplate: addTemplate,
			addTemplates: addTemplates,
			isTemplate: isTemplate,
			templatePath: templatePath
		};

		let defaultTemplates = {
			"/404.tpl": `<h1>Page not found!</h1>`,
			"/403.tpl": `<h1>Forbidden!</h1>`
		};

		//Merge in the default configs with any custom that have been set on startup
		$.conf.templates = {...defaultTemplates,...$.conf.templates} || defaultTemplates;
		$.conf.viewParams = $.conf.viewParams || [];
		$.conf.currentTag = $.conf.currentTag || null;
		$.conf.currentTemplate = $.conf.currentTemplate || null;

		function templatePath(path){
			if(path !== undefined){
				$.conf.currentTemplate = path;
			}
			return $.conf.currentTemplate;
		}

		function build(template,templateData,parameters,blRemoveTags,blProcessTags){

			parameters = parameters || [];
			blRemoveTags = blRemoveTags || false;
			blProcessTags = (blProcessTags !== false);

			let rawHTML = '';
			let previousTemplate = $.conf.currentTemplate

			//Template is relative to current template
			if(template.startsWith('./')){
				template = ($.conf.currentTemplate.split('/').slice(0,-1).join('/')+'/'+template.replace('./','')).replace('//','/');
			}

			if(template in $.conf.templates){
				$.conf.currentTemplate = template;
				rawHTML = (blProcessTags) ? buildRaw($.conf.templates[template],templateData,parameters) : $.conf.templates[template];
			}else{
				console.error('SlenderJS: Template "'+template+'" not found');
				rawHTML = '<div class="SlenderJSError"><p>SlenderJS: Template "'+template+'" not found<br><small><strong>SlenderJS Render: </strong>The requested template was not found</small></p></div>';
			}

			//Restore the previous current template after the current build has run
			$.conf.currentTemplate = previousTemplate;

			return rawHTML;
		}

		function buildRaw(rawHTML,templateData,parameters){

			parameters = parameters || [];

			if(typeof rawHTML === 'function'){
				return rawHTML.call($, ...[templateData,parameters]);
			}

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
			$.conf.templates[strTemplateName] = strHTML;
			$.func.hooks.fire('render_add_template',[ strTemplateName, strHTML ]);
		}

		function addTemplates(templates){
			$.conf.templates = {...$.conf.templates,...templates};
		}

		function isTemplate(template){
			return (template in $.conf.templates);
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

						if(!$.isEmpty(arrResults[5][(blOut)?0:1])){
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
			$.conf.currentTag = strTag;

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

			let blRemoveTags = ('remove-tags' in arrParameters && arrParameters['remove-tags']);//Default: false
			let blProcessTags = (!('process-tags' in arrParameters) || arrParameters['process-tags']);//Default: true

			switch(strType){
				case'data':
				case'setting'://Keeps things more compatible with TwistPHP
				case'global':
					//The tag is looking for data to be returned
					let result = (strType === 'data') ? processArrayItem(strReference, arrData, blReturnArray) : processArrayItem(strReference, $.data, blReturnArray);
					if(result.status === true){
						rawHTML = replaceTag(rawHTML, strTag, result.return, strFunction, result.return_raw, arrParameters);
					}
					break;
				case'date':
					strTagData = $.date(strReference);
					rawHTML = replaceTag(rawHTML,strTag,strTagData,strFunction,[],arrParameters);
					break;

				case'view':

					$.conf.viewParams = arrParameters;
					arrData = typeof(arrData) == 'object' ? {...arrData,...arrParameters} : arrParameters;

					//Template is relative to current template
					if(strReference.startsWith('./')){
						strReference = ($.conf.currentTemplate.split('/').slice(0,-1).join('/')+'/'+strReference.replace('./','')).replace('//','/');
					}

					strTagData = build(strReference,arrData,arrParameters,blRemoveTags,blProcessTags);
					rawHTML = replaceTag(rawHTML,strTag,strTagData,strFunction,[],arrParameters);

					break;

				case'repeater':

					$.conf.viewParams = arrParameters;

					let repeaterData = $.arrayParse(strReference,arrData);
					if(!$.isEmpty(arrParameters['view']) && repeaterData !== null){

						//Allow the original data to be accessed via parent
						$.func.hooks.register('render_tags','parent',arrData);

						for(let key in repeaterData){
							if(repeaterData.hasOwnProperty(key)){
								repeaterData[key]['repeater_index'] = key;
								strTagData += build(arrParameters['view'],repeaterData[key],arrParameters,blRemoveTags,blProcessTags);
							}
						}

						//Remove the original parent data tag
						$.func.hooks.cancel('render_tags','parent');
					}else if('view-empty' in arrParameters){
						strTagData = build(arrParameters['view-empty'],arrData,arrParameters,blRemoveTags,blProcessTags);
					}else if('empty' in arrParameters){
						strTagData = arrParameters['empty'];
					}

					rawHTML = replaceTag(rawHTML,strTag,strTagData,strFunction,[],arrParameters);
					break;

				default:

					let strReplacementData = $.func.hooks.fire('render_tags',[ strReference, arrData, arrParameters ],strType);

					if(!$.isEmpty(strReplacementData)){

						//An array of data has been returned, this is data tags
						if(typeof strReplacementData === 'object'){
							let result = processArrayItem(strReference,strReplacementData,blReturnArray);
							if(result.status === true){
								strReplacementData = result.return;
							}
						}

						rawHTML = replaceTag(rawHTML,strTag,strReplacementData,strFunction,[],arrParameters);
					}else{
						rawHTML = rawHTML.replace('{'+strTag+'}','');
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

					let mxdTempData = $.arrayParse(strKey,arrData);

					result.status = !(mxdTempData === null);//!$.isEmpty(mxdTempData);
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

			if(!$.isEmpty(strFunction)){

				let allowedFunctions = [
					'count',
					'strlen','strtolower','strtoupper',
					//'prettytime','bytestosize',
					'urlencode','urldecode',
					'date'
				];

				if($.inArray(strFunction,allowedFunctions)){

					switch(strFunction){
						case'count':
						case'strlen':
							returndata = return_raw.length;
							break;
						case'strtolower':
							returndata = return_raw.toLowerCase();
							break;
						case'strtoupper':
							returndata = return_raw.toUpperCase();
							break;
						case'intval':
						case'parseint':
							returndata = parseInt(return_raw);
							break;
						case'date':

							let strDateFormat = 'Y-m-d H:i:s';

							if('format' in parameters){
								strDateFormat = parameters['format'];
							}else if(0 in parameters){
								strDateFormat = parameters[0];
							}else if(parameters.length === 1){
								strDateFormat = $.arrayKeys(parameters).splice(0,1);
							}

							returndata = $.date(strDateFormat,Date.parse(returndata));
							break;
						case'prettytime':
							break;
						case'bytestosize':
							break;
						case'urlencode':
							returndata = encodeURI(return_raw);
							break;
						case'urldecode':
							returndata = decodeURI(return_raw);
							break;
					}

				}else{
					console.error('SlenderJS: Function "'+strFunction+'" is not available');
					return '<div class="SlenderJSError"><p>SlenderJS: Function "'+strFunction+'" is not available<br><small><strong>SlenderJS Render: </strong>The requested render tag function was not found</small></p></div>';
				}
			}

			//Allow for iOS 13 and older as they dont support replaceALL
			return (typeof String.prototype.replaceAll === 'function') ? rawHTML.replaceAll('{'+tag+'}',returndata) : rawHTML.replace(new RegExp('\{'+tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')+'\}', 'g'), returndata);
		}

		function condition(mxdValue1,strCondition,mxdValue2){

			let blOut = false;
			let blPass = false;

			//Sanitise and detect type of each variable
			mxdValue1 = detectType(mxdValue1);
			mxdValue2 = detectType(mxdValue2);

			switch(strCondition){
				case'===':
					blPass = (mxdValue2 === 'twst-empty-variable' && ($.isEmpty(mxdValue1) || mxdValue1 === 'twst-undefined-variable'));
					blOut = (blPass || mxdValue1 === mxdValue2);
					break;
				case'!==':
					blPass = (mxdValue2 === 'twst-empty-variable' && !($.isEmpty(mxdValue1) || mxdValue1 === 'twst-undefined-variable'));
					blOut = (blPass || mxdValue1 !== mxdValue2);
					break;
				case'==':
					blPass = (mxdValue2 === 'twst-empty-variable' && ($.isEmpty(mxdValue1) || mxdValue1 === 'twst-undefined-variable'));
					blOut = (blPass || mxdValue1 == mxdValue2 || (mxdValue1 == '' && mxdValue2 === 'twst-undefined-variable') || (mxdValue2 == '' && mxdValue1 === 'twst-undefined-variable'));
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
					blPass = (mxdValue2 === 'twst-empty-variable' && !($.isEmpty(mxdValue1) || mxdValue1 === 'twst-undefined-variable'));
					blOut = (blPass || mxdValue1 != mxdValue2);
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
				}else if(blDetect && mxdValue === 'empty'){
					mxdValue = 'twst-empty-variable';
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
						arrParameters[strKey] = (typeof(mxdValue) === 'string' && mxdValue.includes('|')) ? mxdValue.split('|') : mxdValue;
					}else if(mxdItem.includes('|')){
						mxdItem = detectType(mxdItem);
						arrParameters.push((typeof(mxdItem) === 'string' && mxdItem.includes('|')) ? mxdItem.split('|') : mxdItem);
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
	 * @param $
	 * @constructor
	 */
	function SlenderRouter($){

		//Set all the functions that are publicly accessible
		$.func.router = {
			start: start,
			page: page,
			addRoute: addRoute,
			addRoutes: addRoutes,
			addRedirect: addRedirect,
			findRoute: findRoute,
			current: {},
			temp: {}
		};

		//Set all the functions that are privately accessible (Via ThirdParty registered Hooks)
		$.priv.router = {
			start: start,
			page: page,
			pageReady: pageReady,
			addRoute: addRoute,
			addRoutes: addRoutes,
			addRedirect: addRedirect,
			generateTags: generateTags,
			createPageContainer: createPageContainer,
		};

		let defaultMeta = [
			{ charset: "UTF-8" },
			{ name: "viewport", content: "width=device-width, user-scalable=no, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0" },
			{ "http-equiv": "X-UA-Compatible", content: "ie=edge" }
		];

		let defaultRoutes = {
			"/404": { title: 'Page Not Found', template: '/404.tpl' },
			"/403": { title: 'Permission Denied', template: '/403.tpl' },
			"/401": { title: 'Permission Denied', template: '/401.tpl' }
		};

		//Merge in the default configs with any custom that have been set on startup
		$.conf.transition = $.conf.transition || 'default';
		$.conf.meta = {...defaultMeta,...$.conf.meta} || defaultMeta;
		$.conf.script = $.conf.script || [];
		$.conf.link = $.conf.link || [];
		$.conf.style = $.conf.style || [];
		$.conf.domains = $.conf.domains || [];
		$.conf.routes = {...defaultRoutes,...$.conf.routes} || defaultRoutes;

		registerHooks();
		registerListeners();

		function start(blDOMContentLoaded,startPath){

			if(!$.data.started){

				$.app = document.querySelector('#app') || null;
				$.currentPage = document.querySelector('#app .slenderPage.slenderPageCurrent') || null;
				$.nextPage = document.querySelector('#app .slenderPage.slenderPageNext') || null;

				let blPreRendered = (typeof window.SlenderJS_startPreRendered !== undefined && !$.isEmpty(window.SlenderJS_startPreRendered)) ? window.SlenderJS_startPreRendered : false;
				let blWaitForDOM = blDOMContentLoaded || false;

				$.data.loadingPage = false;
				$.data.startPath = (typeof window.SlenderJS_startPath !== undefined && !$.isEmpty(window.SlenderJS_startPath)) ? window.SlenderJS_startPath : (startPath || window.location.pathname);
				$.data.GET = $.parseQueryString(window.location.href);

				if(!blPreRendered){

					//Add the default/site wide head tags
					generateTags('meta',$.conf.meta,false);
					generateTags('style',$.conf.style,false);
					generateTags('script',$.conf.script,false);
					generateTags('link',$.conf.link,false);

					//Add a class to hide a page by default when it is first loaded in
					generateTags('style',[{contents: '.slenderPage{ display:block; } .slenderPage.slenderPageHidden{ display:none!important;}' }]);

					if(blWaitForDOM){

						console.log('Waiting for DOM to load ...');
						$.data.isLoadedInterval = setInterval(function($){
							if(document.querySelectorAll('[data-slender-loaded="0"]').length === 0){
								clearInterval($.data.isLoadedInterval);
								console.log('Render Page ... ['+$.data.startPath+']');
								$.func.router.page($.data.startPath,$.data.GET);
							}
						},10,$);
					}else{
						//Render the landing page
						page($.data.startPath,$.data.GET);
					}
				}

				$.data.started = true;
			}
		}

		function addRoute(path,route){
			$.conf.routes[path] = route;
			$.func.hooks.fire('router_add_route',[ path, route ]);
		}

		function addRoutes(routes){
			$.conf.routes = routes;
		}

		function addRedirect(path, redirectUrl){
			$.conf.routes[path] = {redirect:redirectUrl};
			$.func.hooks.fire('router_add_redirect',[ path, redirectUrl ]);
		}

		function findRoute(query,type,exactMatch){

			const expandAlias = (aliasRoute) => {
				//Support for Alias pages, pass 'alias' and the page ID in the router data (Alias must be cloned to prevent ref passing)
				if(aliasRoute.alias && aliasRoute.alias > 0){
					let aliasPage = SlenderJS.router.findRoute([aliasRoute.alias],['id'],[true]);
					aliasRoute = (aliasPage && Object.keys(aliasPage).length > 0) ? {...JSON.parse(JSON.stringify(aliasPage[Object.keys(aliasPage)[0]])),...aliasRoute} : aliasRoute;
				}
				return aliasRoute;
			}

			const subFilter = (routes,query,type,match,$) => {

				let searchKey = '';
				if(typeof type === 'string' && type.indexOf('/') !== -1){
					searchKey = type;
					type = 'search';
				}

				let out = [];
				switch(type){
					case'path':
						for(let path in routes){
							if((match && path === query) || (!match && path.toLowerCase().includes(query.toLowerCase()))){
								out[path] = expandAlias(routes[path]);
							}
						}
						break;
					case'search':
						for(let path in routes){
							let result = $.arrayParse(searchKey,routes[path],'/');
							if(
								(match && result === query)
								|| (!match && $.inArray(typeof result,['boolean','number','float','integer']) && result == query)
								|| (!match && typeof result === 'string' && result.toLowerCase().includes(query.toLowerCase()))
								|| (!match && typeof result === 'object' && $.inArray(query,result))
							){
								out[path] = expandAlias(routes[path]);
							}
						}
						break;
					default:
						for(let path in routes){
							if(type in routes[path] && (
								(match && routes[path][type] == query)
								|| (!match && $.inArray(typeof routes[path][type],['boolean','number','float','integer']) && routes[path][type] == query)
								|| (!match && typeof routes[path][type] === 'string' && routes[path][type].toLowerCase().includes(query.toLowerCase()))
								|| (!match && typeof routes[path][type] === 'object' && $.inArray(query,routes[path][type]))
							)
							){
								out[path] = expandAlias(routes[path]);
							}
						}
						break;
				}
				return out;
			}

			let results = $.conf.routes;
			if(query !== 'debug'){
				for(let i = 0; i < query.length; i++){
					results = subFilter(results,query[i],type[i],exactMatch[i],$);
				}
			}

			return results;
		}

		function page(path,GET,transition){

			GET = GET || $.parseQueryString(path);
			transition = transition || null;

			if(!$.app){
				$.app = document.querySelector('#app') || null;
			}

			if(!$.currentPage){
				$.app.innerHTML = '<div class="slenderPage slenderPageCurrent"></div>';
				$.currentPage = $.app.querySelector('.slenderPage.slenderPageCurrent');
			}

			if(!$.data.loadingPage){

				//Reset page queue
				$.data.pageQueue = null;

				//Reset the temp data for the page
				$.func.router.temp = {};

				//A page is loading, prevent any further page load requests until page is loaded
				$.data.loadingPage = true;

				//Load the page, if the page doesn't exist redirect to htaccess (if $.conf.htaccess404 == true) else output 404 page
				//Use VAR instead of LET so that we can access 'routerCurrent' outside and within sub functions
				var routerCurrent = (path in $.conf.routes) ? $.conf.routes[path] : (($.conf.htaccess404) ? {'redirect': path} : $.conf.routes['/404']);

				//Support for Alias pages, pass 'alias' and the page ID in the router data
				if(routerCurrent.alias && routerCurrent.alias > 0){
					let aliasPage = SlenderJS.router.findRoute([routerCurrent.id],['id'],[true]);
					routerCurrent = (aliasPage) ? aliasPage[Object.keys(aliasPage)[0]] : $.conf.routes['/404'];
				}

				//Fire the render page hooks
				routerCurrent = $.func.hooks.fire('router_page_restriction',[ path, routerCurrent, $ ],'router_page_restriction');

				if('redirect' in routerCurrent){
					if(routerCurrent.redirect in $.conf.routes){
						$.data.loadingPage = false;
						page(routerCurrent.redirect);
						return true;
					}else{
						window.location.href = routerCurrent.redirect;
						return true;
					}
				}

				//Ensure that all the defaults are configured
				routerCurrent.title = routerCurrent.title || '';
				routerCurrent.template = routerCurrent.template || '';
				routerCurrent.data = routerCurrent.data || [];
				routerCurrent.meta = routerCurrent.meta || [];
				routerCurrent.get = GET;
				routerCurrent.preventLoad = false;

				//Make the current route publicly accessible
				$.func.router.current = routerCurrent;

				//Set the route data so that it is accessible throughout
				$.func.hooks.register('render_tags','route',routerCurrent.data);

				//Fire the render page hooks
				$.func.hooks.fire('router_page',[ path, routerCurrent ]);

				if(!routerCurrent.preventLoad){
					//Render the page and header, display the page using push states
					pushState(path,routerCurrent.title,pageBody(path, routerCurrent),routerCurrent,transition);
				}

				//Reset the value
				routerCurrent.preventLoad = false;
			}else{
				console.warn('SlenderJS :: Page is already loading, page '+path+' has been queued');
				$.data.pageQueue = {
					path: path,
					get: GET,
					transition: transition
				};
			}
		}

		function pageBody(path, route){

			//Fire the render page body hooks
			$.func.hooks.fire('router_page_body',[ path, route ]);

			$.func.router.temp.pageBody = { html: $.func.render.build(route.template,route.data) };
			$.func.hooks.fire('router_page_body_html',[ $.func.router.temp.pageBody ]);

			return $.func.router.temp.pageBody.html;
		}

		function pageHead(pageInfo){

			//Set the meta title
			let metaTitle = document.querySelector('head title');
			metaTitle.innerHTML = pageInfo.title;

			//Set the browser doc title
			document.title = pageInfo.title;

			generateTags('meta',pageInfo.meta,true);
			generateTags('style',pageInfo.style,true);
			generateTags('script',pageInfo.script,true);
			generateTags('link',pageInfo.link,true);

			//Fire the render page body hooks
			$.func.hooks.fire('router_page_head',[ pageInfo ]);

			return '';
		}

		function pageReady(){

			//Return to the top of the page
			window.scrollTo(0,0);

			let path = $.currentPage.getAttribute('data-path');
			let route = (path in $.conf.routes) ? $.conf.routes[path] : $.conf.routes['/404'];

			pageHead(route);

			//Remove all meta data associated with last page
			document.querySelectorAll('[data-slender-livejs]').forEach(function(elm,index){
				elm.remove();
			});

			let scriptTags = [];
			let scripts = $.currentPage.querySelectorAll('script');
			for(let i = 0; i < scripts.length; i++){
				let newScript = {};
				if(scripts[i].src){
					newScript['src'] = scripts[i].src;
				}else{
					newScript['contents'] = (scripts[i].text || scripts[i].textContent || scripts[i].innerHTML || "" );
				}
				scriptTags.push(newScript);
				scripts[i].remove();
			}

			generateTags('script',scriptTags,true,'livejs');

			$.func.hooks.fire('router_page_ready',[ path, route ]);

			$.data.isLoadedInterval = setInterval(function($,path,route){
				if(document.querySelectorAll('[data-slender-loaded="0"]').length === 0){
					clearInterval($.data.isLoadedInterval);
					window.document.dispatchEvent(new Event("DOMContentLoaded", {
						bubbles: true,
						cancelable: true
					}));
					console.log('SlenderJS :: DOMContentLoaded');
					$.func.hooks.fire('router_page_domcontentloaded',[ path, route ]);
				}

				//The page has finished loading
				$.data.loadingPage = false;

				if($.data.pageQueue){
					console.log('SlenderJS :: Loading queued page... '+$.data.pageQueue.path);
					page(
						$.data.pageQueue.path,
						$.data.pageQueue.get,
						$.data.pageQueue.transition
					);
				}

			},25,$,path,route);
		}

		function generateTags(type,items,blPageItem,dataKey){

			let uniqueKey = !$.isEmpty(dataKey);

			//Data key is optional, defaults to type
			dataKey = dataKey || type;
			items = items || [];
			blPageItem = blPageItem || false;

			if(!blPageItem && uniqueKey && document.querySelectorAll('[data-slender-'+dataKey+']').length){
				return true;
			}

			if(blPageItem){
				//Remove all meta data associated with last page
				document.querySelectorAll('[data-slender-'+dataKey+']').forEach(function(elm,index){
					elm.remove();
				})
			}

			if(items.length){

				//Removable tags goes after title, static tags goes before title
				let metaInsertBeforeElement = (blPageItem) ? document.querySelector('head title').nextSibling : document.querySelector('head title');

				//Go though all the tags and generate/add them
				for(let i = 0; i < items.length; i++){

					let tag = document.createElement(type);
					Object.keys(items[i]).forEach(key => {
						if(key === 'contents'){
							tag.innerHTML = items[i][key];
						}else{
							tag.setAttribute(key, items[i][key]);
						}
					});

					if(blPageItem || uniqueKey){
						//Set an attribute so we know where the tag came from
						tag.setAttribute('data-slender-'+dataKey, '');
					}

					if(!('rel' in items[i] && items[i]['rel'] === 'canonical') && ('href' in items[i] || 'src' in items[i])){
						tag.setAttribute('data-slender-loaded', '0');
						tag.onload = function(e){ e.target.setAttribute('data-slender-loaded','1');}
					}

					document.querySelector('head').insertBefore(tag, metaInsertBeforeElement);
				}
			}
		}

		function createPageContainer(urlPath,pageBody){

			//Create the new page
			let nextPage = document.createElement("div");
			nextPage.classList.add('slenderPage','slenderPageNext','slenderPageHidden');
			nextPage.setAttribute('data-path',urlPath);
			nextPage.innerHTML = pageBody;

			//Insert the page into the app
			//$.app.insertBefore(nextPage, $.app.firstChild);
			$.app.appendChild(nextPage);
			$.nextPage = $.app.querySelector('.slenderPage.slenderPageNext');
		}

		function pushState(urlPath, pageTitle, pageBody, route, transition){

			transition = transition || $.conf.transition;

			$.func.hooks.fire('router_page_transition',[ urlPath, pageTitle, pageBody, route ],transition);

			window.history.pushState({
				"pageBody":pageBody,
				"pageTitle":pageTitle,
				"pageInfo":route,
				"pagePath":urlPath,
				"pageTransition":transition,
			},pageTitle, urlPath);
		}

		function registerHooks(){

			//Register the default page transition (Direct switch, no animation)
			$.func.hooks.register('router_page_transition','default',function(urlPath, pageTitle, pageBody, pageInfo){

				this.priv.router.createPageContainer(urlPath,pageBody);

				//Do the animation (in this case, straight swap)
				this.currentPage.remove();
				this.nextPage.classList.remove('slenderPageNext','slenderPageHidden');
				this.nextPage.classList.add('slenderPageCurrent');
				this.currentPage = this.nextPage;
				this.nextPage = null;

				//@important Page must be marked as ready!
				this.priv.router.pageReady();
			});

			//Register the fade page transition
			$.func.hooks.register('router_page_transition','fade',function(urlPath, pageTitle, pageBody, pageInfo){

				this.priv.router.createPageContainer(urlPath,pageBody);
				this.priv.router.generateTags('style',[{contents: '.slenderFadeIn{opacity: 1!important;} .slenderFadeOut{opacity: 0!important;}'}],false,'transitionFade');

				//Set the opacity filters (0.5s out, 0.5s in)
				this.currentPage.style.opacity = '1';
				this.currentPage.style.transition = 'opacity 0.5s';
				this.nextPage.style.opacity = '0';
				this.nextPage.style.transition = 'opacity 0.5s ease-in-out 0.5s';

				//Start the animation
				this.nextPage.classList.remove('slenderPageNext','slenderPageHidden');
				this.nextPage.classList.add('slenderPageCurrent','slenderFadeIn');
				this.currentPage.classList.add('slenderFadeOut');

				setTimeout(function($){ $.currentPage.remove(); }, 490, this);
				setTimeout(function($){
					$.currentPage = $.nextPage;
					$.nextPage = null;
					//@important Page must be marked as ready!
					$.priv.router.pageReady();
				}, 510, this);
			});
		}

		function registerListeners(){

			window.onpopstate = function(e){
				if(e.state){
					SlenderJS.router.current = e.state.pageInfo;
					$.func.hooks.fire('router_page_transition',[ e.state.pagePath, e.state.pageTitle, e.state.pageBody, e.state.pageInfo ],e.state.pageTransition);
				}
			};

			window.addEventListener('click', function(e){

				let url = null;
				let transition = null;
				let elmA = $.closest(e.target,'a')
				let elmRoute = $.closest(e.target,'[data-slender-route]')

				if(elmA){
					url = elmA.getAttribute('href');
					transition = elmA.getAttribute('data-slender-transition');
				}else if(elmRoute){
					url = elmRoute.getAttribute('data-slender-route');
					transition = elmRoute.getAttribute('data-slender-transition');
				}

				if(url){
					let urlData = $.parseUri(url);
					if(elmA.getAttribute('target') !== '_blank' && (url && !url.startsWith('#') && (url.startsWith('/') || $.inArray(urlData.hostname,$.conf.domains)))){
						e.preventDefault();
						$.data.GET = $.parseQueryString(url);
						page(urlData.pathname,$.data.GET,transition);
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

		$.arrayKeys = function(arrData){
			let keys = [];
			for(let key in arrData){ if(!arrData.hasOwnProperty(key)) continue; keys.push(key) }
			return keys;
		}

		$.inArray = function(item,arrData){
			return (arrData.length && arrData.indexOf(item) > -1);
		}

		$.arrayParse = function(key, arrData, splitChar){
			if(typeof arrData !== 'undefined' && arrData !== null){
				splitChar = splitChar || '/';
				let arrParts = key.split(splitChar);
				key = arrParts.splice(0,1);
				if(typeof arrParts === 'object' && key in arrData){
					return (arrParts.length) ? this.arrayParse(arrParts.join(splitChar),arrData[key],splitChar) : arrData[key];
				}
			}
			return null;
		}

		$.isEmpty = function(val){
			return (val === undefined || val == null || val === 0 || val === '0' || val.length <= 0);
		}

		$.closest = function(el,selector){
			while(!el.matches(selector)){
				el = el.parentNode
				if(!el || el.nodeName === 'BODY'){
					return null;
				}
			}
			return el || null;
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
		 * See: https://gomakethings.com/getting-all-query-string-values-from-a-url-with-vanilla-js/
		 */
		$.parseQueryString = function(url){
			let params = {};
			let parser = document.createElement('a');
			parser.href = url;
			let vars = parser.search.substring(1).split('&');
			for(let i=0; i < vars.length; i++){
				let pair = (vars[i].includes('=')) ? vars[i].split('=') : [vars[i],''];
				params[pair[0]] = decodeURIComponent(pair[1]);
			}
			return params;
		};

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
		 * A formatted version of a popular md5 implementation, Original copyright (c) Paul Johnston & Greg Holt.
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

		/**
		 * See: https://github.com/locutusjs/locutus/blob/master/src/php/datetime/date.js
		 */
		$.date = function(format, timestamp) {
			let jsdate, f
			const txtWords = ['Sun','Mon','Tues','Wednes','Thurs','Fri','Satur','January','February','March','April','May','June','July', 'August','September','October','November','December']
			const formatChr = /\\?(.?)/gi
			const formatChrCb = function(t, s){return f[t] ? f[t]() : s}
			const _pad = function(n, c){
				n = String(n)
				while(n.length < c){ n='0'+n }
				return n
			}
			f = {
				d: function(){return _pad(f.j(), 2)},
				D: function(){return f.l().slice(0, 3)},
				j: function(){return jsdate.getDate()},
				l: function(){return txtWords[f.w()] + 'day'},
				N: function(){return f.w() || 7},
				S: function(){const j = f.j(); let i = j % 10; i = (i <= 3 && parseInt((j % 100) / 10, 10) === 1) ? 0 : i; return ['st', 'nd', 'rd'][i - 1] || 'th'},
				w: function(){return jsdate.getDay()},
				z: function(){const a = new Date(f.Y(), f.n() - 1, f.j()), b = new Date(f.Y(), 0, 1); return Math.round((a - b) / 864e5)},
				W: function(){const a = new Date(f.Y(), f.n() - 1, f.j() - f.N() + 3), b = new Date(a.getFullYear(), 0, 4); return _pad(1 + Math.round((a - b) / 864e5 / 7), 2)},
				F: function(){return txtWords[6 + f.n()]},
				m: function(){return _pad(f.n(), 2)},
				M: function(){return f.F().slice(0, 3)},
				n: function(){return jsdate.getMonth() + 1},
				t: function(){return (new Date(f.Y(), f.n(), 0)).getDate()},
				L: function(){const j = f.Y(); return j % 4 === 0 & j % 100 !== 0 | j % 400 === 0 },
				o: function(){const n = f.n(), W = f.W(), Y = f.Y(); return Y + (n === 12 && W < 9 ? 1 : n === 1 && W > 9 ? -1 : 0) },
				Y: function(){return jsdate.getFullYear()},
				y: function(){return f.Y().toString().slice(-2)},
				a: function(){return jsdate.getHours() > 11 ? 'pm' : 'am'},
				A: function(){return f.a().toUpperCase()},
				B: function(){const H = jsdate.getUTCHours() * 36e2, i = jsdate.getUTCMinutes() * 60, s = jsdate.getUTCSeconds(); return _pad(Math.floor((H + i + s + 36e2) / 86.4) % 1e3, 3)},
				g: function(){return f.G() % 12 || 12 },
				G: function(){return jsdate.getHours() },
				h: function(){return _pad(f.g(),2) },
				H: function(){return _pad(f.G(), 2)},
				i: function(){return _pad(jsdate.getMinutes(), 2)},
				s: function(){return _pad(jsdate.getSeconds(), 2)},
				u: function(){return _pad(jsdate.getMilliseconds() * 1000, 6)},
				e: function(){return jsdate.toLocaleDateString(undefined, {day:'2-digit',timeZoneName: 'short' }).substring(4);},
				I: function(){const a = new Date(f.Y(), 0),c = Date.UTC(f.Y(), 0),b = new Date(f.Y(), 6),d = Date.UTC(f.Y(), 6); return ((a - c) !== (b - d)) ? 1 : 0},
				O: function(){const tzo = jsdate.getTimezoneOffset(), a = Math.abs(tzo); return (tzo > 0 ? '-' : '+') + _pad(Math.floor(a / 60) * 100 + a % 60, 4)},
				P: function(){const O = f.O(); return (O.substr(0, 3) + ':' + O.substr(3, 2))},
				T: function(){return 'UTC'},
				Z: function(){return -jsdate.getTimezoneOffset() * 60},
				c: function(){return 'Y-m-d\\TH:i:sP'.replace(formatChr, formatChrCb)},
				r: function(){return 'D, d M Y H:i:s O'.replace(formatChr, formatChrCb)},
				U: function(){return jsdate / 1000 | 0}
			}
			const _date = function (format, timestamp) {
				jsdate = (timestamp === undefined ? new Date() // Not provided
						: (timestamp instanceof Date) ? new Date(timestamp) // JS Date()
							: (Number.isInteger(timestamp)) ? new Date(timestamp * 1000) : new Date(timestamp.replace(' ','T'))
				)
				return format.replace(formatChr, formatChrCb)
			}
			return _date(format, timestamp)
		}
	}

	return init;
});