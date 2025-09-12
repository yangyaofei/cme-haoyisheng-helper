// ==UserScript==
// @name         好医生-视频一键到底与自动答题
// @namespace    https://dev.limkim.xyz/
// @version      1.1.2
// @description  好医生继续医学教育视频一键看完(含北京市继续医学教育必修课培训), 并且支持考试自动完成
// @author       limkim
// @match        https://cme.haoyisheng.com/cme/polyv.jsp*
// @match        https://bjsqypx.haoyisheng.com/qypx/bj/polyv.jsp*
// @match        https://bjsqypx.haoyisheng.com/qypx/bj/cc.jsp
// @match        https://www.cmechina.net/cme/polyv.jsp*
// @match        https://www.cmechina.net/cme/study2.jsp*
// @match        https://cme.haoyisheng.com/cme/study2.jsp*
// @match        https://cme.haoyisheng.com/cme/exam.jsp*
// @match        https://cme.haoyisheng.com/cme/examQuizFail.jsp*
// @match        https://www.cmechina.net/cme/exam.jsp*
// @match        https://www.cmechina.net/cme/examQuizFail.jsp*
// @match        https://*.haoyisheng.com/*

// @license MIT

// @run-at       document-end
// @grant        unsafeWindow
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_openInTab
// @grant        GM_notification
// @grant        GM_xmlhttpRequest
// ==/UserScript==


(function () {
    'use strict';
    // 获取本地存储的正确答案对象
    const getAnswerObject = () => {
        const answerObject = localStorage.getItem('right_answer_obj') || '{}';
        return JSON.parse(answerObject);
    };
    
    // 获取已尝试答案的对象
    const getTriedAnswersObject = () => {
        const triedAnswers = localStorage.getItem('tried_answers_obj') || '{}';
        return JSON.parse(triedAnswers);
    };
    
    // 保存已尝试答案的对象
    const saveTriedAnswersObject = (triedAnswers) => {
        localStorage.setItem('tried_answers_obj', JSON.stringify(triedAnswers));
    };
    const buttonCssText = 'position: absolute;z-index: 99999;right: 0;padding:10px;cursor:pointer;background-color: #3087d9;color: #fff;box-shadow: 0px 0px 12px rgba(0, 0, 0, .12);';
    // 考试结果页面进行遍历, 得到正确答案
    if (window.location.pathname.includes('examQuizFail') || document.querySelector('.cuoti')) {
        console.log('检测到考试结果页面，开始答案遍历...');
        
        // 获取下一个未尝试的选项
        const getNextUntriedChoice = (currentChoice, triedChoices, questionText) => {
            const allChoices = ['A', 'B', 'C', 'D', 'E'];
            let currentIndex = allChoices.indexOf(currentChoice);
            
            // 找到下一个未尝试的选项
            for (let i = 1; i <= allChoices.length; i++) {
                const nextIndex = (currentIndex + i) % allChoices.length;
                const nextChoice = allChoices[nextIndex];
                
                if (!triedChoices.includes(nextChoice)) {
                    console.log('题目:', questionText, '当前选项:', currentChoice, '下一个未尝试选项:', nextChoice);
                    return nextChoice;
                }
            }
            
            console.log('所有选项都已尝试，重置为A');
            return 'A';
        };
        
        // 循环多选选项
        const getNextMultipleChoice = str => {
            const dic = ['ABCDE', 'ABCD', 'ABD', 'ABC', 'AB', 'A'];
            const index = dic.indexOf(str);
            if (index === 5) {
                console.log('所有多选组合遍历完毕，重置为ABCDE');
                return 'ABCDE';
            }
            const nextCombo = dic[index + 1];
            console.log('当前多选组合:', str, '下一个组合:', nextCombo);
            return nextCombo;
        };
        
        // 获取当前答案列表 - 新页面格式处理
        let nowAnswerStr, nowAnswerList;
        if (window.location.search.includes('ansList=')) {
            nowAnswerStr = window.location.search.split('ansList=')[1].split('&')[0];
            nowAnswerList = nowAnswerStr.split(',');
        } else {
            // 新页面格式，从隐藏字段获取问题列表
            const quesListInput = document.querySelector('input[name="ques_list"]');
            if (quesListInput && quesListInput.value) {
                const quesList = quesListInput.value.split(',');
                nowAnswerList = ['A', 'A', 'A', 'A', 'A'].slice(0, quesList.length); // 默认全选A
                nowAnswerStr = nowAnswerList.join(',');
            } else {
                // 如果找不到ques_list，默认5个题目
                nowAnswerList = ['A', 'A', 'A', 'A', 'A'];
                nowAnswerStr = nowAnswerList.join(',');
            }
        }
        
        // 检测错误题目 - 新页面格式
        const errorQuestions = document.querySelectorAll('.cuoti p span');
        let finished = true;
        
        console.log('错误题目数量:', errorQuestions.length);
        console.log('当前答案列表:', nowAnswerList);
        
        // 获取已尝试的答案记录
        const triedAnswersObject = getTriedAnswersObject();
        const courseId = window.location.search.split('course_id=')[1]?.split('&')[0] || 
                        document.querySelector('input[name="course_id"]')?.value;
        const paperId = window.location.search.split('paper_id=')[1]?.split('&')[0] || 
                       document.querySelector('input[name="paper_id"]')?.value;
        const examId = courseId + '_' + paperId;
        
        if (errorQuestions.length > 0) {
            finished = false;
            // 新页面格式：错误题目显示在.cuoti中
            const quesListInput = document.querySelector('input[name="ques_list"]');
            const quesList = quesListInput && quesListInput.value ? quesListInput.value.split(',') : [];
            const questionTexts = Array.from(document.querySelectorAll('.kaoshi dt')).map(dt => dt.textContent.trim());
            
            console.log('问题列表:', quesList);
            console.log('问题文本:', questionTexts);
            
            // 初始化已尝试答案记录
            if (!triedAnswersObject[examId]) {
                triedAnswersObject[examId] = {};
            }
            
            for (let i = 0; i < errorQuestions.length; i++) {
                const errorText = errorQuestions[i].textContent.trim();
                console.log('错误题目:', errorText);
                
                const questionIndex = questionTexts.findIndex(text => text.includes(errorText));
                
                if (questionIndex !== -1) {
                    const questionText = questionTexts[questionIndex];
                    console.log('找到错误题目索引:', questionIndex, '题目:', questionText, '当前答案:', nowAnswerList[questionIndex]);
                    
                    // 初始化该题目的已尝试记录
                    if (!triedAnswersObject[examId][questionText]) {
                        triedAnswersObject[examId][questionText] = [];
                    }
                    
                    // 记录当前尝试的答案
                    if (!triedAnswersObject[examId][questionText].includes(nowAnswerList[questionIndex])) {
                        triedAnswersObject[examId][questionText].push(nowAnswerList[questionIndex]);
                    }
                    
                    if (nowAnswerList[questionIndex].length === 1) {
                        nowAnswerList[questionIndex] = getNextUntriedChoice(
                            nowAnswerList[questionIndex], 
                            triedAnswersObject[examId][questionText],
                            questionText
                        );
                    } else {
                        nowAnswerList[questionIndex] = getNextMultipleChoice(nowAnswerList[questionIndex]);
                    }
                    
                    console.log('更新后的答案:', nowAnswerList[questionIndex], '已尝试选项:', triedAnswersObject[examId][questionText]);
                    break;
                } else {
                    console.log('未找到匹配的错误题目');
                }
            }
            
            // 保存已尝试答案记录
            saveTriedAnswersObject(triedAnswersObject);
            
            // 重新提交
            console.log('准备重新提交，新答案列表:', nowAnswerList);
            const form = document.querySelector('form[name="form1"]') || document.querySelector('form');
            if (form && (form.action.includes('examDo.jsp') || form.action.includes('exam'))) {
                console.log('通过表单提交');
                form.submit();
            } else {
                // 回退到旧方法
                if (window.location.search) {
                    console.log('通过URL修改提交');
                    window.location.href = window.location.href.replace(nowAnswerStr, nowAnswerList.join(','));
                } else {
                    console.log('无法提交，重新加载页面');
                    // 如果无法修改URL，尝试重新加载
                    location.reload();
                }
            }
        }
        
        if (finished) {
            console.log('所有题目回答正确，保存答案并返回');
            const courseId = window.location.search.split('course_id=')[1]?.split('&')[0] || 
                            document.querySelector('input[name="course_id"]')?.value;
            const paperId = window.location.search.split('paper_id=')[1]?.split('&')[0] || 
                           document.querySelector('input[name="paper_id"]')?.value;
            
            if (courseId && paperId) {
                const examId = courseId + '_' + paperId;
                const answerObject = getAnswerObject();
                answerObject[examId] = nowAnswerList;
                localStorage.setItem('right_answer_obj', JSON.stringify(answerObject));
                console.log('保存正确答案:', nowAnswerList, '考试ID:', examId);
                history.go(-1);
            } else {
                console.log('无法获取课程ID或试卷ID');
            }
        }
        return;
    }
    // 考试页面填写初始答案和正确答案,并提交
    if (window.location.pathname.includes('exam') || document.querySelector('.kaoshi')) {
        const courseId = window.location.search.split('course_id=')[1]?.split('&')[0] || 
                        document.querySelector('input[name="course_id"]')?.value;
        const paperId = window.location.search.split('paper_id=')[1]?.split('&')[0] || 
                       document.querySelector('input[name="paper_id"]')?.value;
        const examId = courseId + '_' + paperId;
        const answerObject = getAnswerObject();
        
        // 清除已尝试答案记录（开始新的考试会话）
        const triedAnswersObject = getTriedAnswersObject();
        if (triedAnswersObject[examId]) {
            console.log('清除已尝试答案记录，开始新的考试会话');
            delete triedAnswersObject[examId];
            saveTriedAnswersObject(triedAnswersObject);
        }
        const autoSelectAnswer = answerArray => {
            const questionItems = document.querySelectorAll('.kaoshi dl');
            for (let i = 0; i < questionItems.length; i++) {
                const answerOptions = questionItems[i].querySelectorAll('dd p input[type="radio"]');
                const answer = answerArray[i];
                
                for (let j = 0; j < answerOptions.length; j++) {
                    const input = answerOptions[j];
                    if (answer.includes(input.value)) {
                        input.checked = true;
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                        input.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                    }
                }
            }
        };
        // 得到正确答案返回后, 直接填写并提交
        if (answerObject[examId]) {
            autoSelectAnswer(answerObject[examId]);
            return document.querySelector('#tjkj').dispatchEvent(new MouseEvent('click'));
        }

        const examSkipButton = document.createElement('button');

        examSkipButton.innerText = '考试? 拿来吧你!';
        examSkipButton.id = 'exam_skip_btn';
        examSkipButton.style.cssText = buttonCssText;
        examSkipButton.style.top = '55px';
        examSkipButton.style.right = '150px';

        examSkipButton.addEventListener('click', () => {
            // 获取题目数量
            const questionCount = document.querySelectorAll('.kaoshi dl').length;
            const defaultAnswers = Array(questionCount).fill('A'); // 单选默认选A
            
            autoSelectAnswer(defaultAnswers);
            
            // 尝试提交表单
            const submitBtn = document.querySelector('#tjkj') || 
                             document.querySelector('input[type="button"][onClick*="doSubmit"]') ||
                             document.querySelector('input[type="button"][value*="提交"]');
            
            if (submitBtn) {
                submitBtn.dispatchEvent(new MouseEvent('click'));
            } else {
                // 直接调用表单提交函数
                if (typeof doSubmit === 'function') {
                    doSubmit();
                } else {
                    const form = document.querySelector('form[name="form1"]') || document.querySelector('form');
                    if (form) form.submit();
                }
            }
        });

        const contentElement = document.querySelector('.content') || document.querySelector('.r_box') || document.body;
        contentElement.appendChild(examSkipButton);

        if (localStorage.getItem('script_auto_exam') === 'true') {
            examSkipButton.dispatchEvent(new MouseEvent('click'));
        }
        return;
    }
    // 视频跳过

    const create = () => {
        const video = document.querySelector('.pv-video') || document.querySelector('video');
        if (video == null){
            return;
        }
        const parent = video.parentElement;
        const videoSkipButton = document.createElement('button');
        const selecterLabel = document.createElement('label');
        const playRateSelecter = document.createElement('select');
        const checkboxContainer = document.createElement('div');
        const videoCheckboxLabel = document.createElement('label');
        const videoCheckbox = document.createElement('input');
        const examCheckboxLabel = document.createElement('label');
        const examCheckbox = document.createElement('input');

        const containerCssText = 'position: absolute;height: 37px;line-height: 37px;top: -40px;right: 130px;';
        const labelCssText = 'vertical-align: middle;margin-right: 5px;line-height: 37px;color: #3087d9;font-size: 15px;';
        const controllerCssText = 'vertical-align: middle;cursor: pointer; margin-right: 5px;';
        videoSkipButton.innerText = '看视频? 拿来吧你!';
        videoSkipButton.style.cssText = buttonCssText;
        checkboxContainer.style.cssText = containerCssText;
        videoCheckboxLabel.innerText = '自动看完:';
        videoCheckboxLabel.style.cssText = labelCssText;
        videoCheckbox.type = 'checkbox';
        videoCheckbox.style.cssText = controllerCssText;
        examCheckboxLabel.innerText = '进入考试后自动开考:';
        examCheckboxLabel.style.cssText = labelCssText;
        examCheckbox.type = 'checkbox';
        examCheckbox.style.cssText = controllerCssText;
        selecterLabel.innerText = '倍速:';
        selecterLabel.style.cssText = labelCssText;
        playRateSelecter.style.cssText = controllerCssText;
        playRateSelecter.style.border = '1px solid #000';
        // 倍速选择器初始化选项
        for (let i = 1; i <= 15; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.label = i;
            playRateSelecter.appendChild(option);
        }

        playRateSelecter.addEventListener('change', () => {
            video.playbackRate = parseInt(playRateSelecter.value);
            localStorage.setItem('play_back_rate', playRateSelecter.value);
        });
        videoCheckbox.addEventListener('change', e => {
            const autoVlaue = e.target.checked;
            localStorage.setItem('script_auto_skip', JSON.stringify(autoVlaue));
        });
        examCheckbox.addEventListener('change', e => {
            const autoVlaue = e.target.checked;
            localStorage.setItem('script_auto_exam', JSON.stringify(autoVlaue));
        });
        videoSkipButton.addEventListener('click', () => {
            video.volume = 0;
            video.playbackRate = parseInt(playRateSelecter.value);
            video.play();
            video.currentTime = video.duration;
        });

        if (document.querySelector('.content .h5')) {
            document.querySelector('.content .h5').style.marginBottom = '50px';
            checkboxContainer.style.top = '-45px';
            videoSkipButton.style.top = '-45px';
            videoSkipButton.style.border = 'none';
        }
        if (document.querySelector('.ccH5playerBox')) {
            document.querySelector('.ccH5playerBox').style.overflow = 'visible';
        }

        checkboxContainer.append(examCheckboxLabel, examCheckbox, videoCheckboxLabel, videoCheckbox, selecterLabel, playRateSelecter);
        //document.querySelector("video-box").append(checkboxContainer, videoSkipButton);
        parent.append(checkboxContainer, videoSkipButton);

        if (localStorage.getItem('script_auto_skip') === 'true') {
            videoCheckbox.checked = true;
            videoSkipButton.dispatchEvent(new MouseEvent('click'));
        }
        if (localStorage.getItem('script_auto_exam') === 'true') {
            examCheckbox.checked = true;
        }

        const localRate = localStorage.getItem('play_back_rate');
        if (localRate && parseInt(localRate) !== NaN && parseInt(localRate) >= 1 && parseInt(localRate) <= 15) {
            playRateSelecter.value = localRate;
            video.playbackRate = parseInt(localRate);
        } else {
            playRateSelecter.value = '10';
            video.playbackRate = 10;
        }
    };
    const start = document.createElement('button')
    start.innerText = 'Grab Video';
    start.addEventListener('click', create);
    document.querySelector("div").prepend(start)
})();
