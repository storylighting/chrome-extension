/**
 *  Make a good attempt at discerning the closest top level container
 *  for a long-form article. Attemps to do so by finding the paragraph
 *  with the most number of words and proceeding upwards until 2/5th
 *  of the words on the page have been enveloped by the selection.
 *
 *  @return {HTMLElement} The HTMLElement that contains the article
 */
function getArticleContainer() {

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

  return selectedContainer;
}

/**
 *  Check if a given element is on a blacklist due to a class or ID match
 *
 *  @returns {HTMLElement, null} returns HTMLElement if not blacklisted, null otherwise.
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
 *  Return the article as plaintext
 *
 *  @param {HTMLElement} pageSelectedContainer the DOM container to pull the article from.
 *  @return {Array<String>} an array of unicode strings representing the paragraphs of the article.
 */
function getArticleContent(pageSelectedContainer){

  var contentContainer = document.createElement("div");
  contentContainer.innerHTML = pageSelectedContainer.innerHTML;

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
 *  Return the article as plaintext
 *
 *  @param {HTMLElement} pageSelectedContainer the DOM container to markup the article.
 *  @param {Array<String>} an array of unicode strings representing the paragraphs of the article.
 *  @return {Array<HTMLElement>} an array of HTMLElements representing the paragraphs to watch.
 */
function markUpArticleParagraphs(pageSelectedContainer, paragraphs){
  var markedUpParagraphs = [];
  var paragraphElements = pageSelectedContainer.getElementsByTagName("p");
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
 *  Attach Scroll Spy to `scroll` like events.
 */
function scrollSpyInit(){
  if (document.addEventListener){
    document.addEventListener("touchmove", handleScroll, false);
    document.addEventListener("scroll", handleScroll, false);
  }
  else if (window.attachEvent){
    window.attachEvent("onscroll", handleScroll);
  }
}

/**
 *  Spys on Paragraphs
 *
 *  @global {Array<Object>} paragraphScrollSpies
 */
function updateParagraphSpies(){
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

  };
}

/**
 *  Select primary paragraph reader is reading.
 *
 *  @global {Array<Object>} paragraphScrollSpies
 *  @return {Array<HTMLElement>} an array of HTMLElements representing the paragraphs to watch.
 */
function selectDominantParagraph(){
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
 *  Pulls color from a given HTMLElement pargraph.
 *
 *  @param {Number} paragraphId
 *  @return {Array<HTMLElement>} an array of HTMLElements representing the paragraphs to watch.
 */
function selectColor(id){
  let colorInputElement = document.getElementById(`storyLight-paragraph-id-${id}-color-input`);
  return colorInputElement.value;
}

/**
 *  Principal Queuing Function. Handles every scroll event.
 *
 *  @global {Number} paragraphId
 */
function handleScroll(){
  // Update Spies
  updateParagraphSpies();

  // Select Paragraph
  let paragraphSpy = selectDominantParagraph();

  // Throttle Unnecessary Updates
  if (paragraphSpy === undefined || paragraphSpy === null){} else{
    if (paragraphId != paragraphSpy.id){
      let color = selectColor(paragraphSpy.id);

      // Update Color Response
      chrome.runtime.sendMessage({type: "colorUpdate", color: color}, function(response) {return true;});

      paragraphId = paragraphSpy.id
    }
  }
}

var paragraphId = -1;
var pageSelectedContainer = getArticleContainer();
var paragraphs = getArticleContent(pageSelectedContainer);
var paragraphElements = markUpArticleParagraphs(pageSelectedContainer, paragraphs);
var paragraphScrollSpies = paragraphElements.map(function(element) {return {
  inViewPort: false,
  partialView: false,
  boxVisible: 0,
  element: element,
  id: element.dataset.paragraphId,
  height: 0
};});

scrollSpyInit();
