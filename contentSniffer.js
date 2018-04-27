/**
 * Make a good attempt at discerning the closest top level container for a
 * long-form article. Attemps to do so by finding the paragraph with the most
 * number of words and proceeding upwards until 2/5th of the words on the page
 * have been enveloped by the selection.
 *
 * Borrows code and style from @ZachSaucier [Just Read Chrome Extension](https://github.com/ZachSaucier/Just-Read)
 *
 * @return {Object} An object consisting of the following properties:
 *     - element {HTMLElement} The DOM element that contains the main body of
 *           the article
 *     - method {Array<String>} An Array of Strings consisting of methods used
 *           to uniquely identify the article container upon future page loads
 *           from the remote database. Valid values include `id` and `class`.
 *     - class {String=} a string representing the list of class names to
 *           match; class names are separated by whitespace
 *     - id {String=} The ID of the element to locate. The ID is case-sensitive
 *           string which is unique within the document; only one element may
 *           have any given ID.
 */
function detectArticleContainer() {

  var numWordsOnPage = document.body.innerText.match(/\S+/g).length, // Total Words on Page
  ps = document.body.querySelectorAll("p"); // All `p` paragraph selectors

  // Find the paragraphs with the most words in it
  var pWithMostWords = document.body,
  highestWordCount = 0;

  // If page uses no `p` tags fallback on `div` tags as paragraphs
  if(ps.length === 0) {
    ps = document.body.querySelectorAll("div");
  }

  for(var i = 0; i < ps.length; i++) {
      if(checkElementAgainstBlacklist(ps[i]) // Make sure it's not in our blacklist
        && checkElementAgainstBlacklist(ps[i].parentNode) // and its parent...
        && ps[i].offsetHeight !== 0) { //  Make sure it's visible on the regular page

        // Determine word count
        var myInnerText = ps[i].innerText.match(/\S+/g);
        if(myInnerText) {
          var wordCount = myInnerText.length;
          if(wordCount > highestWordCount) {
            // Update new highest word count paragraph
            highestWordCount = wordCount;
            pWithMostWords = ps[i];
          }
        }
      }

      // Remove elements that were hidden on the original page
      if(ps[i].offsetHeight === 0)
        ps[i].dataset.simpleDelete = true;
      }

    // Keep selecting more generally until over 2/5th of the words on the page have been selected
    var selectedContainer = pWithMostWords,
    wordCountSelected = highestWordCount;

    while(wordCountSelected / numWordsOnPage < 0.4
      && selectedContainer != document.body
      && selectedContainer.parentNode.innerText) {

      // Given a new selector find the best match for an article container
      selectedContainer = selectedContainer.parentNode;
      wordCountSelected = selectedContainer.innerText.match(/\S+/g).length;
  }

  // Make sure a single p tag is not selected
  if(selectedContainer.tagName === "P") {
    selectedContainer = selectedContainer.parentNode;
  }

  // provide way of finding the element in the future.
  let container = {
    element: selectedContainer,
    id: "",
    class: "",
    method: []
  };

  if (selectedContainer.id !== ""){
    container.id = selectedContainer.id;
    container.method.push("id");
  }

  if (selectedContainer.className !== ""){
    container.class = selectedContainer.className;
    container.method.push("class");
  }

  return container;
}

/**
 * Detects the article headline or title. Pulls the infromation from the page's
 * <title> element attempting to remove the website title or publisher
 * following common patterns of using tokens to seperate the two. The method
 * looks for the following common tokens:
 *     - — (em dash),
 *     - – (en dash),
 *     - - (hypen),
 *     - | (pipe),
 *     - : (colon)
 *
 * Borrows code and style from @ZachSaucier [Just Read Chrome Extension](https://github.com/ZachSaucier/Just-Read)
 *
 * @returns {string} Article title
 */
function detectArticleTitle() {
    // Get the page's title
    var title = document.head.querySelector("title").innerText;

    // Get the part before the first — if it exists
    if(title.indexOf(' — ') > 0) {
        return title.substr(0, title.indexOf(' — '));
    }

    // Get the part before the first – if it exists
    if(title.indexOf(' – ') > 0) {
        return title.substr(0, title.indexOf(' – '));
    }

    // Get the part before the first - if it exists
    if(title.indexOf(' - ') > 0) {
        return title.substr(0, title.indexOf(' - '));
    }

    // Get the part before the first | if it exists
    if(title.indexOf(' | ') > 0) {
        return title.substr(0, title.indexOf(' | '));
    }

    // Get the part before the first : if it exists
    if(title.indexOf(' : ') > 0) {
        return title.substr(0, title.indexOf(' : '));
    }

    return title;
}

/**
 * A helper to assist in checking common elements for a date like object. Used
 * by `detectArticleDate`
 *
 * Borrows code and style from @ZachSaucier [Just Read Chrome Extension](https://github.com/ZachSaucier/Just-Read)
 *
 * @param element {HTMLElement} The DOM element to check
 * @param attributeList {Array<String>} An array of strings representing properties
 *     to check for a date
 * @param deleteMe {Boolean} Whether or not to delete the element before
 *     isolating article paragraph text.
 * @returns {String}
 */
function checkElemForDate(element, attributeList, deleteMe) {
  var myDate = false;
  if(element) {
    for(var i = 0; i < attributeList.length; i++) {
      if(element[attributeList[i]]
        && element[attributeList[i]] != "" //  Make sure it's not empty
        && element[attributeList[i]].split(' ').length < 10) { // Make sure the date isn't absurdly long
          myDate = element[attributeList[i]];

          if(deleteMe) {
            element.dataset.simpleDelete = true; // Flag it for removal later
          }
      }
    }
  }
  return myDate;
}

/**
 * Detect the article publication date by looking for elements that commonly
 * contain the date / time of an article based on their class or meta
 * attributes. Additionally attempts a quick santisation by removing any line
 * breaks `<br>`, carriage returns `\n`, or newsroom added "on"'s.
 *
 * Borrows code and style from @ZachSaucier [Just Read Chrome Extension](https://github.com/ZachSaucier/Just-Read)
 *
 * @param {HTMLElement} articleContainer The DOM element that contains the
 *     main body of the article
 * @returns {string} Article publication date
 */
function detectArticleDate(articleContainer) {
    // Make sure that the articleContainer isn't empty. If so utilise the body of the HTML page.
    if(articleContainer == null)
        articleContainer = document.body;

    // Check to see if there's a date class
    var date = false,
        toCheck = [
            [articleContainer.querySelector('[class^="date"]'), ["innerText"], true],
            [articleContainer.querySelector('[class*="-date"]'), ["innerText"], true],
            [articleContainer.querySelector('[class*="_date"]'), ["innerText"], true],
            [document.body.querySelector('[class^="date"]'), ["innerText"], false],
            [document.body.querySelector('[class*="-date"]'), ["innerText"], false],
            [document.body.querySelector('[class*="_date"]'), ["innerText"], false],
            [document.head.querySelector('meta[name^="date"]'), ["content"], false],
            [document.head.querySelector('meta[name*="-date"]'), ["content"], false],
            [articleContainer.querySelector('time'), ["datetime", "innerText"], true],
            [document.body.querySelector('time'), ["datetime", "innerText"], false],
        ];


    for(var i = 0; i < toCheck.length; i++) {
        if(!date) {
            var checkObj = toCheck[i];
            date = checkElemForDate(checkObj[0], checkObj[1], checkObj[2])
        }
    }

    if(date)
        return date.replace(/on\s/gi, '').replace(/(?:\r\n|\r|\n)/gi, '&nbsp;').replace(/[<]br[^>]*[>]/gi,'&nbsp;'); // Replace <br>, \n, and "on"

    return "Unknown date";
}

/**
 * Detect the article author or authors by looking for elements that commonly
 * contain the date and / or time of an article based on their class or meta
 * attributes. If an author or authors are found, additionally sanitise it by
 * converting it to Title Case and remove any "by"'s added by the newsroom.
 *
 * Borrows code and style from @ZachSaucier [Just Read Chrome Extension](https://github.com/ZachSaucier/Just-Read)
 *
 * @param {HTMLElement} articleContainer The DOM element that contains the
 *     main body of the article
 * @returns {string} Article author name or authors names
 */
function detectArticleAuthor(articleContainer) {
    // Make sure that the articleContainer isn't empty. If so utilise the body of the HTML page.
    if(articleContainer == null)
        articleContainer = document.body;

    var author = null;

    // Check to see if there's an author rel in the article
    var elem = articleContainer.querySelector('[rel*="author"]');
    if(elem) {
        if(elem.innerText.split(/\s+/).length < 5 && elem.innerText.replace(/\s/g,'') !== "") {
            elem.dataset.simpleDelete = true; // Flag it for removal later
            author = elem.innerText;
        }
    }

    // Check to see if there's an author class
    elem = articleContainer.querySelector('[class*="author"]');
    if(author === null && elem) {
        if(elem.innerText.split(/\s+/).length < 5 && elem.innerText.replace(/\s/g,'') !== "") {
            elem.dataset.simpleDelete = true; // Flag it for removal later
            author = elem.innerText;
        }
    }

    elem = document.head.querySelector('meta[name*="author"]');
    // Check to see if there is an author available in the meta, if so get it
    if(author === null && elem)
        author = elem.getAttribute("content");

    // Check to see if there's an author rel in the body
    elem = document.body.querySelector('[rel*="author"]');
    if(elem) {
        if(elem.innerText.split(/\s+/).length < 5 && elem.innerText.replace(/\s/g,'') !== "") {
            author = elem.innerText;
        }
    }

    elem = document.body.querySelector('[class*="author"]');
    if(author === null && elem) {
        if(elem.innerText.split(/\s+/).length < 6 && elem.innerText.replace(/\s/g,'') !== "") {
            author = elem.innerText;
        }
    }

    if(author !== null && typeof author !== "undefined") {
        // If it's all caps, try to properly capitalize it
        if(author === author.toUpperCase()) {
            var words = author.split(" "),
                wordsLength = words.length;
            for(var i = 0; i < wordsLength; i++) {
                if(words[i].length < 3 && i != 0 && i != wordsLength)
                    words[i] = words[i].toLowerCase(); // Assume it's something like "de", "da", "van" etc.
                else
                    words[i] = words[i].charAt(0).toUpperCase() + words[i].substr(1).toLowerCase();
            }
            author = words.join(' ');
        }
        return author.replace(/by\s/ig, ''); // Replace "by"
    }

    return "Unknown author";
}

/**
 * Check if a given element is on a blacklist due to a class or ID match
 *
 * Borrows code and style from @ZachSaucier [Just Read Chrome Extension](https://github.com/ZachSaucier/Just-Read)
 *
 * @global blacklist {Array<String>} An array of strings representing class
 *     names to ignore in paragraph counting for automated article main body
 *     container selection.
 * @returns {HTMLElement, null} returns HTMLElement if not blacklisted, null
 *     otherwise.
 */
var blacklist = ["comment"];
function checkElementAgainstBlacklist(elem) {
  if(typeof elem != "undefined" && elem != null) {
    var className = elem.className,
    id = elem.id;
    for(var i = 0; i < blacklist.length; i++) {
        if((typeof className != "undefined" && className.indexOf(blacklist[i]) >= 0)
          || (typeof id != "undefined" && id.indexOf(blacklist[i]) >= 0)) {

          // Blacklisted Element
          return null;
      }
    }
  }

  // Okay Element
  return elem;
}

/**
 * Isolate the principal body of the article, removing photographs, asides,
 * etc. to retrieve individual pargraphs.
 *
 * @param {HTMLElement} articleContainer The DOM element that contains the
 *     main body of the article
 * @return {Array<String>} An array of unicode strings representing the
 *     paragraphs of the main body of the article.
 */
function getArticleParagraphsText(articleContainer){

  var contentContainer = document.createElement("div");
  contentContainer.innerHTML = articleContainer.innerHTML;

  // Clean up strange formatting using `br` instead of `p`
  var pattern =  new RegExp ("<br/?>[ \r\n\s]*<br/?>", "g");
  contentContainer.innerHTML = contentContainer.innerHTML.replace(pattern, "</p><p>");

  // Strip inline styles
  var contentElements = contentContainer.getElementsByTagName("*");
  for (var i = 0, max = contentElements.length; i < max; i++) {
    var elem = contentElements[i];

    if(elem != undefined || elem != null) {
      elem.removeAttribute("style");
      elem.removeAttribute("color");
      elem.removeAttribute("width");
      elem.removeAttribute("height");
      elem.removeAttribute("background");
      elem.removeAttribute("bgcolor");
      elem.removeAttribute("border");

          // Remove elements that only have &nbsp;
          if(elem.dataset && (elem.innerHTML.trim() === '&nbsp;' || elem.innerHTML.trim() === ''))
          elem.dataset.simpleDelete = true;

          // See if the pre's have code in them
          var isPreNoCode = true;
          if(elem.nodeName === "PRE" && !leavePres) {
            isPreNoCode = false;

            for(var j = 0, len = elem.children.length; j < len; j++) {
              if(elem.children[j].nodeName === "CODE")
                isPreNoCode = true;
            }

              // If there's no code, format it
              if(!isPreNoCode) {
                elem.innerHTML = elem.innerHTML.replace(/\n/g, '<br/>')
              }
            }

          // Replace the depreciated font element and pre's without code with p's
          if(elem.nodeName === "FONT" || !isPreNoCode) {
            var p = document.createElement('p');
            p.innerHTML = elem.innerHTML;

            elem.parentNode.insertBefore(p, elem);
            elem.parentNode.removeChild(elem);
          }

          // Remove any inline style, LaTeX text, or noindex elements and things with aria hidden
          if((elem.nodeName === "STYLE"
            || elem.nodeName === "SVG"
            || elem.nodeName === "NOINDEX"
            || elem.nodeName === "HR"
            || elem.nodeName === "ASIDE"
            || elem.nodeName === "FIGURE"
            || elem.getAttribute("encoding") == "application/x-tex"
            || (elem.getAttribute("aria-hidden") == "true"
            || ( typeof elem.className === 'string' && elem.className.split(' ').some(function(c){ return /(meta|contributions|ad-slot)/.test(c); }))
             && !elem.classList.contains("mwe-math-fallback-image-inline"))))
            elem.setAttribute("data-simple-delete", true);

    }
  }

  // Remove the elements
  var deleteObjs = contentContainer.querySelectorAll("[data-simple-delete]");
  for (var i = 0, max = deleteObjs.length; i < max; i++) {
    deleteObjs[i].parentNode.removeChild(deleteObjs[i]);
  };

  // Simple Paragraph Contents
  var paragraphs = [];
  var paragraphElements = contentContainer.getElementsByTagName("p");
  for (var i = 0, max = paragraphElements.length; i < max; i++) {
    var elem = paragraphElements[i];
    paragraphs.push(elem.innerText.trim());
  }

  return paragraphs;
}

/**
 * Add color droplets and markup to the article's paragraph elements allowing
 * the individual paragraphs to be color editable and detected for queuing
 * purposes.
 *
 * @param {HTMLElement} articleContainer The DOM element that contains the
 *     main body of the article
 * @param {Array<String>} paragraphs An array of unicode strings representing
 *     the paragraphs of the main body of the article. Used to verify marking
 *     up paragraphs according to determined order.
 * @return {Array<HTMLElement>} An array of `HTMLElement`s representing the
 *     paragraph elements to watch.
 */
function markUpArticleParagraphs(articleContainer, paragraphs){
  var markedUpParagraphs = [];
  var paragraphElements = articleContainer.getElementsByTagName("p");
  let j = 0;
  for (let i = 0, max = paragraphElements.length; i < max; i++) {
    let elem = paragraphElements[i];
    let paragraph = elem.innerText.trim();
    let paragraphCandidate = paragraphs[j];

    if (paragraph == paragraphCandidate){
      elem.dataset.paragraphId=i;
      elem.innerHTML += `<div class="storyLight-color-indicator"><label class="storyLight-color-label"><input class="storyLight-color-input" id="storyLight-paragraph-id-${i}-color-input" type="color"><svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" xml:space="preserve" viewBox="0 0 62 76.3"><path id="storyLight-paragraph-id-${i}-color-fill" class="storyLight-color-fill" d="M34.7,1.5c-1.1-1-2.5-1.5-3.9-1.5C29.4,0,28,0.5,27,1.5l0,0L8.9,20.9H9C-3,33.8-3,53.8,9,66.7c5.7,6.1,13.7,9.6,22,9.6l0,0c8.3,0,16.3-3.4,22-9.5C65,53.9,65,33.9,53,21L34.7,1.5z"></path></svg></label></div>`;

      // Setup Watch
      let fill = document.getElementById(`storyLight-paragraph-id-${i}-color-fill`);
      document.getElementById(`storyLight-paragraph-id-${i}-color-input`).addEventListener("input", function(){
        fill.setAttribute("style", `fill: ${event.target.value};`);
      }, false);

      markedUpParagraphs.push(elem);
      j++;
    }
  }

  return markedUpParagraphs;
}

/**
 * Add color droplets and markup to the article's paragraph elements allowing
 * the individual paragraphs to be color editable and detected for queuing
 * purposes.
 *
 * @param {HTMLElement} articleContainer The DOM element that contains the
 *     main body of the article
 * @param {Array<String>} paragraphs An array of unicode strings representing
 *     the paragraphs of the main body of the article. Used to verify marking
 *     up paragraphs according to determined order.
 * @param {Array<String>} colors An array of hexadecimal colors specified with:
 *     #RRGGBB, where RR (red), GG (green) and BB (blue) are hexadecimal
 *     integers between 00 and FF specifying the intensity of the color.
 * @return {Array<HTMLElement>} An array of `HTMLElement`s representing the
 *     paragraph elements to watch.
 */
function setParagraphColors(articleContainer, paragraphs, colors){
  var editedParagraphs = [];
  var paragraphElements = articleContainer.getElementsByTagName("p");
  let j = 0;
  for (let i = 0, max = paragraphElements.length; i < max; i++) {
    let elem = paragraphElements[i];
    let paragraph = elem.innerText.trim();
    let paragraphCandidate = paragraphs[j];

    if (paragraph == paragraphCandidate){
      if (setArticleParagraphColor(i, colors[i])){
        editedParagraphs.push(elem);
      }
      j++;
    }
  }

  return editedParagraphs;
}

/**
 * Initalise the paragraph scroll spy events. Mark up DOM and attach scroll spy
 * queuing logic to `scroll` like events.
 *
 * @param {HTMLElement} articleContainer The DOM element that contains the
 *     main body of the article
 * @param {Array<String>} paragraphs An array of unicode strings representing
 *     the paragraphs of the main body of the article.
 * @param {Array<String>=} colors An array of hexadecimal colors specified
 *     with: #RRGGBB, where RR (red), GG (green) and BB (blue) are hexadecimal
 *     integers between 00 and FF specifying the intensity of the color.
 */
function scrollSpyInit(articleContainer, paragraphs, colors = null){
  var paragraphElements = markUpArticleParagraphs(articleContainer, paragraphs);

  if (colors !== null && paragraphs.length == colors.length){
    setParagraphColors(articleContainer, paragraphs, colors);
  }

  // Create Spy Objects
  var paragraphScrollSpies = paragraphElements.map(function(element) {return {
    inViewPort: false,
    partialView: false,
    boxVisible: 0,
    element: element,
    id: element.dataset.paragraphId,
    height: 0
  };});

  if (document.addEventListener){
    document.addEventListener("touchmove", function (){
      handleScroll(paragraphScrollSpies);
    }, false);
    document.addEventListener("scroll", function (){
      handleScroll(paragraphScrollSpies);
    }, false);
  }
  else if (window.attachEvent){
    window.attachEvent("onscroll", function (){
      handleScroll(paragraphScrollSpies);
    });
  }
}

/**
 * Update the spy objects about their current visibility, position, and order
 * on the page to be used to make decisions about queuing. Provides four
 * updated properties for each spy:
 *     - height {Number} Height in pixels of the element from the top of the
 *           client viewport.
 *     - inViewPort {Boolean} Whether or not the element is visible in the
 *           viewport, including partially obstructed visibility
 *     - partialView {Boolean} Whether or not the element is clipped in the
 *           viewport.
 *     - boxVisible {Number} Percentage of element visible to the user in the
 *           boundary box.
 *
 * @param {Array<Object>} paragraphScrollSpies An array of spy objects
 *     consisting of the following properties:
 *         - height {Number} Height in pixels of the element from the top of
 *               the client viewport.
 *         - inViewPort {Boolean} Whether or not the element is visible in the
 *               viewport, including partially obstructed visibility
 *         - partialView {Boolean} Whether or not the element is clipped in the
 *               viewport.
 *         - boxVisible {Number} Percentage of element visible to the user in
 *               the boundary box.
 *         - element {HTMLElement} Reference to the DOM element the spy
 *               represents
 *         - id {Number} Paragraph number, Zero-index based
 */
function updateParagraphSpies(paragraphScrollSpies){
  let windowHeight = window.innerHeight;
  for (var i in paragraphScrollSpies){
    let element = paragraphScrollSpies[i];
    let elementRect = element.element.getBoundingClientRect();

    element.height = elementRect.top;
    element.inViewPort = false;
    element.partialView = false;
    element.boxVisible = 0;

    if (elementRect.top < 0 && (elementRect.top + elementRect.height) > 0){
      // Check Partial Elements
      element.inViewPort = true;
      element.partialView = true;
      element.boxVisible = (elementRect.top + elementRect.height) / elementRect.height;
    }

    if (elementRect.top > 0 && elementRect.top < windowHeight && (elementRect.top + elementRect.height) > windowHeight){
      // Check Partial Elements
      element.inViewPort = true;
      element.partialView = true;
      element.boxVisible = (windowHeight - elementRect.top) / elementRect.height;
    }

    if (elementRect.top < 0 && (elementRect.top + elementRect.height) > windowHeight){
      // Check Partial Elements
      element.inViewPort = true;
      element.partialView = true;
      element.boxVisible = windowHeight / elementRect.height;
    }

    // On Screen
    if (elementRect.top > 0 && elementRect.top < windowHeight){
      element.inViewPort = true;
      element.boxVisible = 1;
    }
  }
}

/**
 * Select primary paragraph reader is reading.
 *
 * @param {Array<Object>} paragraphScrollSpies An array of spy objects
 *     consisting of the following properties:
 *         - height {Number} Height in pixels of the element from the top of
 *               the client viewport.
 *         - inViewPort {Boolean} Whether or not the element is visible in the
 *               viewport, including partially obstructed visibility
 *         - partialView {Boolean} Whether or not the element is clipped in the
 *               viewport.
 *         - boxVisible {Number} Percentage of element visible to the user in
 *               the boundary box.
 *         - element {HTMLElement} Reference to the DOM element the spy
 *               represents
 *         - id {Number} Paragraph number, Zero-index based
 *  @return {Object} The Spy Object representing the paragraph to use for
 *      queuing purposes consisting of the following properties:
 *         - height {Number} Height in pixels of the element from the top of
 *               the client viewport.
 *         - inViewPort {Boolean} Whether or not the element is visible in the
 *               viewport, including partially obstructed visibility
 *         - partialView {Boolean} Whether or not the element is clipped in the
 *               viewport.
 *         - boxVisible {Number} Percentage of element visible to the user in
 *               the boundary box.
 *         - element {HTMLElement} Reference to the DOM element the spy
 *               represents
 *         - id {Number} Paragraph number, Zero-index based
 */
function selectDominantParagraph(paragraphScrollSpies){
  let visibleParagraphs = paragraphScrollSpies.filter(spy => spy.inViewPort && spy.boxVisible > .5);
  let rankedParagraphs = visibleParagraphs.sort(function (a,b){
    return a.height-b.height;
  });
  if (rankedParagraphs.length > 0){
    return rankedParagraphs[0];
  }else{
    return null;
  }
}

/**
 * Retrieves color from a given article main body pargraph.
 *
 * @param {Number} paragraphId Paragraph number, Zero-index based
 * @return {String} Hexadecimal value for the color tagged
 */
function getArticleParagraphColor(id){
  let colorInputElement = document.getElementById(`storyLight-paragraph-id-${id}-color-input`);
  return colorInputElement.value;
}

/**
 * Update the color for a given article main body pargraph.
 *
 * @param {Number} paragraphId Paragraph number, Zero-index based
 * @param {Array<String>=} colors A hexadecimal color specified with: #RRGGBB,
 *     where RR (red), GG (green) and BB (blue) are hexadecimal integers
 *     between 00 and FF specifying the intensity of the color.
 * @return {Boolean} Whether or not the paragraph color was successfully changed.
 */
function setArticleParagraphColor(id, value){
  let colorInputElement = document.getElementById(`storyLight-paragraph-id-${id}-color-input`);
  colorInputElement.value = value;
  // Dispatch the event to mark the change on the UI.
  colorInputElement.dispatchEvent(new Event('input'));
  return colorInputElement.value;
}

/**
 * Principal Queuing Function. Manages Story Lighting experience, updates
 * paragraph spies with new location information, determines the principal
 * paragraph being read, determines if a new color look needs to be issued.
 * Triggered every scroll event.
 *
 * @param {Array<Object>} paragraphScrollSpies An array of spy objects
 *     consisting of the following properties:
 *         - height {Number} Height in pixels of the element from the top of
 *               the client viewport.
 *         - inViewPort {Boolean} Whether or not the element is visible in the
 *               viewport, including partially obstructed visibility
 *         - partialView {Boolean} Whether or not the element is clipped in the
 *               viewport.
 *         - boxVisible {Number} Percentage of element visible to the user in
 *               the boundary box.
 *         - element {HTMLElement} Reference to the DOM element the spy
 *               represents
 *         - id {Number} Paragraph number, Zero-index based
 *  @global {Number} paragraphId Current paragraph number, Zero-index based
 */
function handleScroll(paragraphScrollSpies){
  // Update Spies
  updateParagraphSpies(paragraphScrollSpies);

  // Select Paragraph
  let paragraphSpy = selectDominantParagraph(paragraphScrollSpies);

  // Throttle Unnecessary Updates
  if (paragraphSpy === undefined || paragraphSpy === null){} else{
    if (paragraphId != paragraphSpy.id){
      let color = getArticleParagraphColor(paragraphSpy.id);

      // Update Color Response
      chrome.runtime.sendMessage({type: "colorUpdate", color: color}, function(response) {return true;});

      // Update NEW Current Paragraph
      paragraphId = paragraphSpy.id
    }
  }
}

/**
 * Get an article container through information retrieved from remote database
 * of pre-computed article colours.
 *
 * @param {Object} container An object consisting of the following properties:
 *     - method {Array<String>} An Array of Strings consisting of methods used
 *           to uniquely identify the article container upon future page loads
 *           from the remote database. Valid values include `id` and `class`.
 *     - class {String=} a string representing the list of class names to
 *           match; class names are separated by whitespace
 *     - id {String=} The ID of the element to locate. The ID is case-sensitive
 *           string which is unique within the document; only one element may
 *           have any given ID.
 * @return {Object} An object consisting of the following properties:
 *     - element {HTMLElement} The DOM element that contains the main body of
 *           the article
 *     - method {Array<String>} An Array of Strings consisting of methods used
 *           to uniquely identify the article container upon future page loads
 *           from the remote database. Valid values include `id` and `class`.
 *     - class {String=} a string representing the list of class names to
 *           match; class names are separated by whitespace
 *     - id {String=} The ID of the element to locate. The ID is case-sensitive
 *           string which is unique within the document; only one element may
 *           have any given ID.
 */
function getArticleContainer(container){
  let element;
  // Priority is given to elements with an `id`
  if (container.method.includes("id")){
    element = document.getElementById(container.id);
  }

  // Check for the an element w/ classes matching
  if (container.method.includes("class")){
    let elements = document.getElementsByClassName(container.class);

    // Currently can only handel if the class names are unique.
    if (elements.length == 1){
      element = elements[0];
    }
  }

  if (element){
    container.element = element;
    return container;
  } else {
    return null;
  }
}

var paragraphId = -1;
chrome.runtime.sendMessage({
  type: "checkArticleContent",
  url: window.location.href,
}, function(response) {
  if (response === undefined || !("exists" in response) || (typeof response.exists == 'undefined')) {
    console.error("[Story Lighting Reader] Improper Response to `checkArticleContent` query.");
  } else {
    if (response.exists){
      // Article Processed Already
      var pageSelectedContainer = getArticleContainer(response.article.element);
      var paragraphs = response.article.paragraphs;

      var colors = null;
      if (!("colors" in response.article) || (typeof response.article.colors == 'undefined')) {
        console.error("[Story Lighting Reader] Missing article paragraph `color` array from response.");
      } else {
        if (response.article.colors.length != response.article.paragraphs.length){
          console.error("[Story Lighting Reader] Article content length mismatch between paragraph `colors` aray and `paragraphs` text array.");
        } else {
          colors = response.article.colors;
        }
      }

      // Start Paragraph Scroll Spies
      scrollSpyInit(pageSelectedContainer.element, paragraphs, colors);
    } else {
      // Process New Article
      var pageSelectedContainer = detectArticleContainer();
      var paragraphs = getArticleParagraphsText(pageSelectedContainer.element);

      // Send Article for Processing
      chrome.runtime.sendMessage({
        type: "sendArticleContent",
        element: {
          method: pageSelectedContainer.method,
          class: pageSelectedContainer.class,
          id: pageSelectedContainer.id
        },
        url: window.location.href,
        title: detectArticleTitle(),
        author:detectArticleAuthor(pageSelectedContainer.element),
        date: detectArticleDate(pageSelectedContainer.element),
        paragraphs: paragraphs
      }, function(response) {return true;});

      // Start Paragraph Scroll Spies
      scrollSpyInit(pageSelectedContainer.element, paragraphs);
    }
  }
});
