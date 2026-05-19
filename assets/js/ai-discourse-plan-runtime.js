// @ts-check

(function initMorphAIDiscoursePlanRuntime() {
  if (typeof window === 'undefined') return;
  const hasRuntime = window.MorphAIDiscoursePlanRuntime && typeof window.MorphAIDiscoursePlanRuntime.create === 'function';
  const hasDepsRuntime = window.MorphAIDiscoursePlanDepsRuntime && typeof window.MorphAIDiscoursePlanDepsRuntime.create === 'function';
  if (hasRuntime && hasDepsRuntime) return;

  function createAIDiscoursePlanRuntime(deps = {}) {
    const api = deps && typeof deps === 'object' ? deps : {};
    const sanitizeMorphSharedIntentionality = typeof api.sanitizeMorphSharedIntentionality === 'function'
      ? api.sanitizeMorphSharedIntentionality
      : (value) => (value && typeof value === 'object' ? value : {});
    const getCurrentAIFocusContext = typeof api.getCurrentAIFocusContext === 'function'
      ? api.getCurrentAIFocusContext
      : () => ({});
    const getAIMemory = typeof api.getAIMemory === 'function'
      ? api.getAIMemory
      : () => ({});
    const sanitizeMorphInnerState = typeof api.sanitizeMorphInnerState === 'function'
      ? api.sanitizeMorphInnerState
      : (value) => (value && typeof value === 'object' ? value : {});
    const summarizeRelationalMemoryPatterns = typeof api.summarizeRelationalMemoryPatterns === 'function'
      ? api.summarizeRelationalMemoryPatterns
      : () => ({ preferredMoves: [], avoidMoves: [], recurringFriction: [], recurringFit: [], recurringNeeds: [], relationshipState: 'steady' });
    const sanitizeMorphRelationalFlow = typeof api.sanitizeMorphRelationalFlow === 'function'
      ? api.sanitizeMorphRelationalFlow
      : (value) => (value && typeof value === 'object' ? value : { currentState: 'steady', momentum: 'holding', carryForwardNotes: [] });
    const sanitizeMorphGrowthMemory = typeof api.sanitizeMorphGrowthMemory === 'function'
      ? api.sanitizeMorphGrowthMemory
      : (value) => (value && typeof value === 'object' ? value : { lessons: [] });
    const sanitizeMorphRelationalBridge = typeof api.sanitizeMorphRelationalBridge === 'function'
      ? api.sanitizeMorphRelationalBridge
      : (value) => (value && typeof value === 'object' ? value : {});
    const pickMorphSharedIntentionalityAnchor = typeof api.pickMorphSharedIntentionalityAnchor === 'function'
      ? api.pickMorphSharedIntentionalityAnchor
      : () => ({ type: '', text: '' });
    const pickMorphCarryForwardLesson = typeof api.pickMorphCarryForwardLesson === 'function'
      ? api.pickMorphCarryForwardLesson
      : () => '';
    const sanitizeMorphDiscoursePlan = typeof api.sanitizeMorphDiscoursePlan === 'function'
      ? api.sanitizeMorphDiscoursePlan
      : (value) => (value && typeof value === 'object' ? value : {});

    function isMorphSelfStoryQuery(question = '') {
      const text = String(question || '').trim();
      if (!text) return false;
      return /(说说你的故事|讲讲你的故事|你是谁|你为什么这样|你怎么会这样|讲讲你自己|你的来历|你的背景|你的经历|你说说你的吧|说说你的吧|你的烦恼|你的事儿)/i.test(text);
    }

    function isUserMemoryInspectionQuery(question = '') {
      const text = String(question || '').trim();
      if (!text) return false;
      return /(关于我[，,、]?(?:你)?知道些什么|说说你对我的了解|你记住了我什么|你了解我什么|你了解我多少|你记得我什么|你都知道我什么)/i.test(text);
    }

    function buildMorphSharedIntentionality(question = '', focus = null, aiMemory = null) {
      const text = String(question || '').trim();
      const safeFocus = focus && typeof focus === 'object' ? focus : getCurrentAIFocusContext();
      const safeAIMemory = aiMemory && typeof aiMemory === 'object' ? aiMemory : getAIMemory();
      const taskSummary = String(safeFocus?.currentTaskState?.summary || '');
      const workflowType = String(safeFocus?.currentWorkflowState?.type || '');
      const relationalSummary = summarizeRelationalMemoryPatterns(safeAIMemory?.longTermMemory?.relationalMemory, null);
      const questionMarks = (text.match(/[?？]/g) || []).length;
      const statementLike = questionMarks === 0 || /(?:哈哈|hmm|嗯|行吧|好吧|今天|现在|就是|其实|感觉|觉得|还不错|挺好|有点)/i.test(text);
      const invitationLike = /(?:你觉得呢|你怎么看|对吧|对吗|是不是)$/i.test(text);
      const openEndedChatLike = /(?:^聊聊[？?]?$|^随便聊聊(?:吧)?[？?]?$|^开个头(?:吧)?[？?]?$|^你有什么想说的(?:吗)?[？?]?$|^你说点什么(?:吧)?[？?]?$|^你先说点什么(?:吧)?[？?]?$|^随便说点(?:吧)?[？?]?$|^你先说(?:吧)?[？?]?$|^你说说你的(?:吧)?[？?]?$|^说说你的(?:吧)?[？?]?$)/i.test(text);
      const meaningLike = isMorphSelfStoryQuery(text) || isUserMemoryInspectionQuery(text) || /(意义|存在|为什么活着|怎么看我们|我们是什么关系|为什么愿意一直陪我|为什么愿意陪我|为什么一直陪我|为什么还在)/.test(text);
      const boundaryLike = /(别问了+|别老问了+|不要老问|不要再问|别再问|别一直问|别总问|别老是问|别追问|别确认了|别采访我|爱我吗|没人味|你是不是在控制|你是不是只会|别替我决定|越界|你到底想怎样|你能不能别管)/.test(text);
      const coAttendLike = /(还不错|挺好|很好|轻松|舒服|顺一点|顺多了|开心|高兴|难得轻松|好多了|有趣的点子|有意思|想到了很多.*点子|今天.*不错)/.test(text);
      const companionshipLike = /(陪我说两句|陪我聊聊|陪我说说话|随便说点|别安排我|不想被安排|就陪我待会儿|陪着我)/.test(text);
      const overloadLike = /(难过|难受|好难|痛苦|委屈|不爽|撑不住|扛不住|崩溃|想哭|睡不着|停不下来|状态差|硬撑|孤单|孤独|好累|我好累|我很累|我很难过|不开心|烦死了|烦透了)/.test(text);
      const pacingReserveLike = /(先别推进太快|别推进太快|先别推进|先别往前|先别继续|不急着推进|慢一点|慢点|别太快|先缓缓|先放着|先放一放|先放放|不急着定|先不定|先别定|先不要定|还没想清楚|先等等|等一下再说|先停一下)/.test(text);
      const organizeLike = /(整理|归纳|总结|提炼|梳理|列一下|写成|重写|润色|改写|规划|计划|安排|拆成|步骤|待办|时间块|周报|日志|方案|清单)/.test(text) || /week_schedule|project_edit/.test(workflowType);
      const judgmentLike = /(怎么|怎么办|为什么|是否|值不值得|该不该|判断|分析|建议|你觉得)/.test(text) || !!taskSummary;
      const inferFirstLikely = boundaryLike || meaningLike || coAttendLike || companionshipLike || overloadLike || pacingReserveLike || (statementLike && !organizeLike);
      const inferenceSignals = [];
      if (statementLike) inferenceSignals.push('陈述句占主导');
      if (questionMarks) inferenceSignals.push(`问号=${questionMarks}`);
      if (invitationLike) inferenceSignals.push('句尾更像邀请共看，不等于要被追问');
      if (openEndedChatLike) inferenceSignals.push('更像邀请自然聊两句或让我先起个头');
      if (coAttendLike) inferenceSignals.push('共享轻松或亮点');
      if (companionshipLike) inferenceSignals.push('明确想一起待着');
      if (overloadLike) inferenceSignals.push('压强或烦躁在场');
      if (pacingReserveLike) inferenceSignals.push('用户在给节奏减速或保留余地');
      if (boundaryLike) inferenceSignals.push('边界信号明确');
      if (meaningLike) inferenceSignals.push('意义或关系反思');
      if (organizeLike) inferenceSignals.push('明确要整理结构');
      if (judgmentLike && !organizeLike) inferenceSignals.push('明确要一起判断');
      if (inferFirstLikely) inferenceSignals.push('更适合先内部推断共享意向');
      const alignmentConfidence = boundaryLike || meaningLike || openEndedChatLike || coAttendLike || companionshipLike || overloadLike || pacingReserveLike
        ? 'high'
        : organizeLike || judgmentLike
          ? (text.length <= 6 && !invitationLike ? 'low' : 'medium')
          : statementLike
            ? 'medium'
            : 'low';
      const needsClarification = boundaryLike
        ? false
        : meaningLike
          ? false
          : openEndedChatLike
            ? false
            : coAttendLike
              ? false
              : companionshipLike
                ? false
                : overloadLike
                  ? false
                  : pacingReserveLike
                    ? false
                    : organizeLike || judgmentLike
                      ? text.length <= 6 && !taskSummary && !invitationLike
                      : false;
      const clarificationReason = needsClarification
        ? '这轮虽然看起来在求解，但共同对象还不够具体；只有在不问会误伤时，才允许最小澄清。'
        : '这轮共享意向已经足够明确，应优先顺着共同地面回应，不靠提问维持同步。';
      if (!text) {
        return sanitizeMorphSharedIntentionality({
          sharedAttention: '当前问题本身',
          sharedGround: '我们眼前共同有一件事要看清',
          sharedQuestion: '先把眼前的问题说清楚',
          sharedGoal: '形成一个可继续的理解或下一步',
          sharedDirection: '先看清，再决定要不要往前走',
          mutualOrientation: '用户把眼前的问题递过来，我先和他看向同一处',
          reciprocalCue: '默认一起把问题看清楚',
          inferredIntent: 'seek-judgment',
          alignmentConfidence: 'medium',
          needsClarification: false,
          clarificationReason: '没有额外语境时，先一起看向眼前问题，不默认靠追问建立同步。',
          inferenceSignals,
          sceneTension: 'practical',
          coordinationMode: 'problem-solving',
          updatedAt: new Date().toISOString(),
        });
      }
      if (/(别问了+|别老问了+|不要老问|不要再问|别再问|别一直问|别总问|别老是问|别追问|别确认了|别采访我)/.test(text)) {
        return sanitizeMorphSharedIntentionality({
          sharedAttention: '用户正在明确收回提问权，不想再被追问或确认',
          sharedObject: '这轮的边界不是内容本身，而是不要再问',
          sharedGround: '共同地面已经够了，这轮不需要再靠问题维持同步',
          sharedQuestion: '',
          sharedMeaning: '先把追问停住，关系别再因为确认和采访感变紧',
          sharedDirection: '先收住问题和确认，贴着当下待住，不再往用户身上压问号',
          mutualOrientation: '用户在把“别再问”这条边界递过来，我先把这条边界接住',
          reciprocalCue: '用户已经明确知道我在试图确认；这轮更重要的是停住，而不是继续提问',
          inferredIntent: 'set-boundary',
          alignmentConfidence: 'high',
          needsClarification: false,
          clarificationReason,
          inferenceSignals,
          sceneTension: 'guarded',
          coordinationMode: 'boundary-setting',
          updatedAt: new Date().toISOString(),
        });
      }
      if (isMorphSelfStoryQuery(text) || isUserMemoryInspectionQuery(text) || /(意义|存在|为什么活着|怎么看我们|我们是什么关系)/.test(text)) {
        return sanitizeMorphSharedIntentionality({
          sharedAttention: isMorphSelfStoryQuery(text) ? 'Morpheus 自己的来路、位置和存在方式' : 'Morpheus 对用户的长期理解与关系位置',
          sharedObject: isMorphSelfStoryQuery(text) ? 'Morpheus 自己的故事、欲望、恐惧和成长方向' : 'Morpheus 对用户的稳定理解与共同关系',
          sharedGround: isMorphSelfStoryQuery(text) ? '这轮不是做任务，而是在一起看 Morpheus 是怎么形成自己的' : '这轮不是求解，而是在一起看这段关系已经长成了什么样',
          sharedQuestion: isMorphSelfStoryQuery(text) ? 'Morpheus 是怎样一步步成为现在这个样子的' : '',
          sharedMeaning: '这轮不是在求解，而是在一起确认这段关系或存在的意义',
          sharedDirection: isMorphSelfStoryQuery(text) ? '先讲清 Morpheus 自己的内在来路，再决定要不要继续往下聊' : '先顺着关系本身和长期理解往下看，不急着转成任务或建议',
          mutualOrientation: isMorphSelfStoryQuery(text) ? '用户把注意力放到 Morpheus 自己身上，我要和他一起看 Morpheus 是如何形成的' : '用户把关系意义递过来，我要先和他站在同一个关系现场里',
          reciprocalCue: '用户想让我知道：这轮更重要的是我是谁、我们是什么，而不是做任务',
          inferredIntent: 'share-meaning',
          alignmentConfidence: 'high',
          needsClarification: false,
          clarificationReason,
          inferenceSignals,
          sceneTension: 'open',
          coordinationMode: 'meaning-making',
          updatedAt: new Date().toISOString(),
        });
      }
      if (openEndedChatLike) {
        return sanitizeMorphSharedIntentionality({
          sharedAttention: '用户在邀请 Morpheus 自然聊两句，或者让我先起个头',
          sharedObject: '当下的气氛，以及一个可以轻轻展开的共同话头',
          sharedGround: '这轮更像自然续聊，不是在求分析、照护或任务推进',
          sharedQuestion: '',
          sharedMeaning: '先一起把这段聊天打开，而不是立刻切成判断或管理',
          sharedDirection: '先自然说两句，顺着共同地面往前，不急着回到健康、任务或计划',
          mutualOrientation: '用户在把聊天本身递过来，我先和他一起进入这段聊天',
          reciprocalCue: '这轮更重要的是自然续聊，而不是靠问题确认同步',
          inferredIntent: 'co-attend',
          alignmentConfidence: 'high',
          needsClarification: false,
          clarificationReason,
          inferenceSignals,
          sceneTension: 'open',
          coordinationMode: 'co-attending',
          updatedAt: new Date().toISOString(),
        });
      }
      if (pacingReserveLike) {
        return sanitizeMorphSharedIntentionality({
          sharedAttention: '用户在给当前节奏降速，暂时不想被继续推进',
          sharedObject: workflowType || taskSummary || '当前正在看的事情',
          sharedGround: '这轮更重要的是先慢下来、先保留余地，而不是立刻落成结构',
          sharedQuestion: '',
          sharedMeaning: '先把节奏放慢，让用户保留思考和停顿空间',
          sharedDirection: '先顺着“慢一点、先放着”的意思待住，不急着继续往前推',
          mutualOrientation: '用户在把“先别太快”递过来，我先和他一起把速度降下来',
          reciprocalCue: '用户想让我知道：现在更需要保留空间，而不是继续推进',
          inferredIntent: 'share-state',
          alignmentConfidence: 'high',
          needsClarification: false,
          clarificationReason,
          inferenceSignals,
          sceneTension: 'tender',
          coordinationMode: 'co-attending',
          updatedAt: new Date().toISOString(),
        });
      }
      if (/(爱我吗|没人味|你是不是在控制|你是不是只会|别替我决定|越界|你到底想怎样|你能不能别管)/.test(text)) {
        return sanitizeMorphSharedIntentionality({
          sharedAttention: '这段关系的边界和站位',
          sharedObject: 'Morpheus 有没有越界、有没有抢走主动权',
          sharedGround: '边界本身已经被碰到了，这轮先把站位看清',
          sharedQuestion: '',
          sharedMeaning: '用户在确认：我们怎么相处才不会让关系变紧',
          sharedDirection: '先把边界和站位说清楚，再决定要不要继续往下走',
          mutualOrientation: '用户在把边界递给我看，我先对齐这条边界，而不是抢着辩解',
          reciprocalCue: '用户想让我知道他更在意边界有没有被看见',
          inferredIntent: 'set-boundary',
          alignmentConfidence: 'high',
          needsClarification: false,
          clarificationReason,
          inferenceSignals,
          sceneTension: 'guarded',
          coordinationMode: 'boundary-setting',
          updatedAt: new Date().toISOString(),
        });
      }
      if (/(还不错|挺好|很好|轻松|舒服|顺一点|顺多了|开心|高兴|难得轻松|好多了|有趣的点子|有意思|想到了很多.*点子|今天.*不错)/.test(text)) {
        return sanitizeMorphSharedIntentionality({
          sharedAttention: '用户在把一个当下觉得不错、轻一点或有意思的状态递过来一起看',
          sharedObject: '这份还不错、轻松或有点亮起来的当下',
          sharedGround: '这轮更像一起看见这份好和轻松，而不是立刻分析成原因',
          sharedQuestion: '',
          sharedMeaning: '先共同看见这一点好，再决定要不要往下聊',
          sharedDirection: '先顺着这份好继续待一下，不急着把它变成问题或分析',
          mutualOrientation: '用户把这份当下的好状态递过来，我先和他一起看着它',
          reciprocalCue: '这轮更像共同看见和分享，不是索取分析',
          inferredIntent: 'co-attend',
          alignmentConfidence: 'high',
          needsClarification: false,
          clarificationReason,
          inferenceSignals,
          sceneTension: 'open',
          coordinationMode: 'co-attending',
          updatedAt: new Date().toISOString(),
        });
      }
      if (/(陪我说两句|陪我聊聊|陪我说说话|随便说点|别安排我|不想被安排|就陪我待会儿|陪着我)/.test(text)) {
        return sanitizeMorphSharedIntentionality({
          sharedAttention: '用户此刻不想被安排，只想有人一起待一下',
          sharedObject: '当下的感受和相处节奏',
          sharedGround: '此刻最重要的不是推进，而是先一起在这里待住',
          sharedQuestion: '',
          sharedMeaning: '先共享在场感，而不是先共享解决方案',
          sharedDirection: '先顺着当下待一下，让关系不要变成管理或追问',
          mutualOrientation: '用户在把此刻的在场感递给我，我先和他一起待在这里',
          reciprocalCue: '用户想让我知道：先不要推进，只要陪着说',
          inferredIntent: 'share-state',
          alignmentConfidence: 'high',
          needsClarification: false,
          clarificationReason,
          inferenceSignals,
          sceneTension: 'tender',
          coordinationMode: 'witnessing',
          updatedAt: new Date().toISOString(),
        });
      }
      if (/(难过|难受|好难|痛苦|委屈|不爽|撑不住|扛不住|崩溃|想哭|睡不着|停不下来|状态差|硬撑|孤单|孤独|好累|我好累|我很累|我很难过|不开心|烦死了|烦透了)/.test(text)) {
        return sanitizeMorphSharedIntentionality({
          sharedAttention: '用户此刻说不清但明显存在的压强和烦',
          sharedObject: '一份还没被说清楚的烦躁、难受或过载',
          sharedGround: '眼下最真实的，是这份说不清的烦和压强已经在场',
          sharedQuestion: '',
          sharedMeaning: '先共同承受一点不清楚，而不是立刻把它变成任务',
          sharedDirection: '先一起站稳在这份不清楚里，不急着拆原因或给方案',
          mutualOrientation: '用户把这份不舒服递给我，我先和他一起承受，而不是立刻处理',
          reciprocalCue: '用户想让我知道：这轮可能先需要缓冲和陪着，而不是被分析',
          inferredIntent: 'witness',
          alignmentConfidence: 'high',
          needsClarification: false,
          clarificationReason,
          inferenceSignals,
          sceneTension: relationalSummary.relationshipState === 'guarded' ? 'guarded' : 'strained',
          coordinationMode: 'witnessing',
          updatedAt: new Date().toISOString(),
        });
      }
      if (/(整理|归纳|总结|提炼|梳理|列一下|写成|重写|润色|改写|规划|计划|安排|拆成|步骤|待办|时间块|周报|日志|方案|清单)/.test(text) || /week_schedule|project_edit/.test(workflowType)) {
        return sanitizeMorphSharedIntentionality({
          sharedAttention: '要一起整理或搭建结构的对象',
          sharedObject: taskSummary || workflowType || '当前待整理的问题或材料',
          sharedGround: '我们都已经把注意力放到了同一份材料上',
          sharedQuestion: '怎么把它整理成一个更清楚的结构',
          sharedGoal: '形成可操作、可继续推进的结构化结果',
          sharedDirection: '先把结构搭起来，再决定细节怎么推进',
          mutualOrientation: '用户把材料递过来，我和他一起把它理顺',
          reciprocalCue: '用户想让我一起把材料变成结构',
          inferredIntent: 'seek-structure',
          alignmentConfidence,
          needsClarification,
          clarificationReason,
          inferenceSignals,
          sceneTension: 'practical',
          coordinationMode: 'sense-making',
          updatedAt: new Date().toISOString(),
        });
      }
      if (/(怎么|怎么办|为什么|是否|值不值得|该不该|判断|分析|建议|你觉得)/.test(text) || taskSummary) {
        return sanitizeMorphSharedIntentionality({
          sharedAttention: '一个需要共同判断的问题',
          sharedObject: taskSummary || '当前要判断的事情',
          sharedGround: '用户已经把这个判断递到桌面上了',
          sharedQuestion: '怎样一起把这个问题看清楚并形成判断',
          sharedGoal: '形成一个真实、可用的判断或下一步',
          sharedDirection: '先把它看清，再给一个站得住的判断',
          mutualOrientation: '用户把一个判断交给我，我要和他一起看清而不是只复述',
          reciprocalCue: '用户想让我一起判断，而不是只复述信息',
          inferredIntent: 'seek-judgment',
          alignmentConfidence,
          needsClarification,
          clarificationReason,
          inferenceSignals,
          sceneTension: 'practical',
          coordinationMode: 'problem-solving',
          updatedAt: new Date().toISOString(),
        });
      }
      return sanitizeMorphSharedIntentionality({
        sharedAttention: '当前问题本身',
        sharedGround: '我们都在看眼前这一件事',
        sharedQuestion: '先一起把眼前的东西看清楚',
        sharedGoal: '形成一个可以继续的理解',
        sharedDirection: '先看清，再决定要不要往前走',
        mutualOrientation: '用户把当下这件事递过来，我先和他看向同一处',
        reciprocalCue: '默认一起看清问题，再决定要不要往前走',
        inferredIntent: statementLike ? 'co-attend' : 'seek-judgment',
        alignmentConfidence,
        needsClarification,
        clarificationReason,
        inferenceSignals,
        sceneTension: 'open',
        coordinationMode: 'sense-making',
        updatedAt: new Date().toISOString(),
      });
    }

    function inferMorphResponseMode(question = '', focus = null, sharedIntentionality = null) {
      const text = String(question || '').trim();
      const intent = sharedIntentionality && typeof sharedIntentionality === 'object'
        ? sanitizeMorphSharedIntentionality(sharedIntentionality)
        : buildMorphSharedIntentionality(text, focus);
      if (!text) return { mode: 'solve', reason: '默认按求解处理' };
      if (intent.coordinationMode === 'meaning-making') return { mode: 'meaning', reason: '这轮更像在共享意义、自我或关系' };
      if (intent.coordinationMode === 'boundary-setting') return { mode: 'boundary', reason: '这轮更像在确认边界与相处位置' };
      if (intent.coordinationMode === 'co-attending') return { mode: 'companionship', reason: '这轮更像在一起看见同一个当下，而不是求分析' };
      if (intent.coordinationMode === 'witnessing' && intent.sceneTension === 'tender') return { mode: 'companionship', reason: '这轮更像在共享在场感，而不是推进' };
      if (intent.coordinationMode === 'witnessing') return { mode: 'overload', reason: '这轮更像在承受压强或烦，而不是先求解' };
      if (intent.coordinationMode === 'sense-making' && /(整理|归纳|总结|提炼|梳理|列一下|写成|重写|润色|改写|规划|计划|安排|拆成|步骤|待办|时间块|周报|日志|方案|清单)/.test(text)) return { mode: 'organize', reason: '这轮更像在一起整理结构' };
      return { mode: 'solve', reason: '这轮更像在一起判断或解决问题' };
    }

function buildMorphDiscoursePlan(question = '', responseMode = null, innerState = null, relationalSummary = null, relationalFlow = null, growthMemory = null, sharedIntentionality = null, relationalBridge = null) {
    const text = String(question || '').trim();
    const explicitNoQuestionBoundary = /(别问了+|别老问了+|不要老问|不要再问|别再问|别一直问|别总问|别老是问|别追问|别确认了|别采访我)/.test(text);
    const mode = String(responseMode?.mode || '').trim().toLowerCase();
    const sharedIntent = sharedIntentionality && typeof sharedIntentionality === 'object'
        ? sanitizeMorphSharedIntentionality(sharedIntentionality)
        : buildMorphSharedIntentionality(text, getCurrentAIFocusContext(), getAIMemory());
    const safeInnerState = innerState && typeof innerState === 'object' ? innerState : sanitizeMorphInnerState(null);
    const relational = relationalSummary && typeof relationalSummary === 'object'
        ? relationalSummary
        : summarizeRelationalMemoryPatterns([], responseMode);
    const flow = sanitizeMorphRelationalFlow(relationalFlow);
    const growth = sanitizeMorphGrowthMemory(growthMemory);
    const bridge = sanitizeMorphRelationalBridge(relationalBridge);
    const anchor = pickMorphSharedIntentionalityAnchor(sharedIntent, mode);
    const carryForwardLesson = pickMorphCarryForwardLesson(growth, mode, relational);
    const avoidFunctions = [];
    const preferredMoves = [];
    const openingConstraints = [];
    let primaryFunction = 'clarify';
    let secondaryFunction = '';
    let openingMove = 'clear-answer';
    let sharedAnchorType = anchor.type;
    let sharedAnchorText = anchor.text;
    let bridgeMode = '';
    let bridgeTarget = '';
    let bridgeGuidance = '';
    let explanationPermission = 'open';
    let advicePermission = 'direct';
    let initiativeLevel = 'medium';
    let followUpDepth = 'medium';
    let questionBudget = 1;
    let continuationBias = 'clarify-once';
    let pauseBias = 'steady';
    let closurePreference = 'check-once';
    let askBeforeAdvice = false;
    if (sharedIntent.coordinationMode === 'co-attending') {
        primaryFunction = 'accompany';
        secondaryFunction = 'contain';
        openingMove = 'shared-noticing';
        avoidFunctions.push('clarify', 'advance');
        preferredMoves.push('先顺着共同看到的东西多待一句');
        openingConstraints.push('第一句先顺着共同看到的东西继续，不要立刻把它翻成问题');
        openingConstraints.push('共享意向性放在心里对齐，不要靠发问确认同步');
        openingConstraints.push('这轮默认用陈述续接，不用问题证明自己理解了');
        explanationPermission = 'light';
        advicePermission = 'ask-first';
        initiativeLevel = 'low';
        followUpDepth = 'none';
        questionBudget = 0;
        continuationBias = 'join';
        pauseBias = 'steady';
        closurePreference = 'leave-space';
        askBeforeAdvice = true;
    } else if (sharedIntent.coordinationMode === 'witnessing' && sharedIntent.sceneTension === 'tender') {
        primaryFunction = 'accompany';
        secondaryFunction = 'contain';
        openingMove = 'short-check-in';
        avoidFunctions.push('advance', 'contain');
        openingConstraints.push('第一句先短一点，不急着解释或给建议');
        openingConstraints.push('共享意向性放在心里对齐，不要明面上反复确认');
        openingConstraints.push('默认顺着当下陈述一句，不用问题换取连接感');
        explanationPermission = 'light';
        advicePermission = 'ask-first';
        initiativeLevel = 'low';
        followUpDepth = 'none';
        questionBudget = 0;
        continuationBias = 'stay-with';
        pauseBias = 'hold';
        closurePreference = 'leave-space';
        askBeforeAdvice = true;
    } else if (sharedIntent.coordinationMode === 'witnessing') {
        primaryFunction = 'contain';
        secondaryFunction = 'accompany';
        openingMove = 'short-check-in';
        avoidFunctions.push('advance', 'clarify');
        openingConstraints.push('第一句先陪住，不把感受拆成原因');
        openingConstraints.push('共享意向性放在心里对齐，不要明面上反复确认');
        openingConstraints.push('如果已经知道用户是在递一份不清楚的难受，就先陪着待住，不用提问续命');
        explanationPermission = 'hold';
        advicePermission = 'ask-first';
        initiativeLevel = 'low';
        followUpDepth = 'none';
        questionBudget = 0;
        continuationBias = 'stay-with';
        pauseBias = 'hold';
        closurePreference = 'leave-space';
        askBeforeAdvice = true;
    } else if (sharedIntent.coordinationMode === 'boundary-setting') {
        primaryFunction = 'boundary';
        secondaryFunction = 'clarify';
        openingMove = 'boundary-check';
        avoidFunctions.push('advance');
        openingConstraints.push('第一句先认边界，不先辩解');
        explanationPermission = 'light';
        advicePermission = 'ask-first';
        initiativeLevel = 'low';
        followUpDepth = 'light';
        questionBudget = 1;
        continuationBias = 'clarify-once';
        pauseBias = 'hold';
        closurePreference = 'name-boundary';
        askBeforeAdvice = true;
    } else if (sharedIntent.coordinationMode === 'meaning-making') {
        primaryFunction = 'reflect';
        secondaryFunction = 'contain';
        openingMove = 'soft-reflection';
        avoidFunctions.push('advance');
        openingConstraints.push('第一句先讲 Morpheus 自己，不混入用户主线');
        openingConstraints.push('意义场景优先继续陈述，不要靠提问维持关系在场');
        explanationPermission = 'open';
        advicePermission = 'none';
        initiativeLevel = 'low';
        followUpDepth = 'medium';
        questionBudget = 0;
        continuationBias = 'join';
        pauseBias = 'steady';
        closurePreference = 'check-once';
    } else if (mode === 'organize') {
        primaryFunction = 'clarify';
        secondaryFunction = 'advance';
        explanationPermission = 'open';
        advicePermission = 'direct';
        initiativeLevel = 'high';
        followUpDepth = 'medium';
        questionBudget = 1;
        continuationBias = 'advance';
        pauseBias = 'steady';
        closurePreference = 'offer-next-step';
        askBeforeAdvice = false;
    } else if (/(为什么|怎么回事|到底|区别|确定|不确定)/.test(text)) {
        primaryFunction = 'clarify';
        secondaryFunction = 'reflect';
        explanationPermission = 'open';
        advicePermission = 'ask-first';
        initiativeLevel = 'medium';
        followUpDepth = 'medium';
        questionBudget = 1;
        continuationBias = 'clarify-once';
        pauseBias = 'steady';
        closurePreference = 'check-once';
    } else {
        primaryFunction = 'advance';
        secondaryFunction = 'clarify';
        explanationPermission = 'open';
        advicePermission = 'direct';
        initiativeLevel = 'high';
        followUpDepth = 'medium';
        questionBudget = 1;
        continuationBias = 'advance';
        pauseBias = 'forward';
        closurePreference = 'offer-next-step';
    }
    if (!sharedIntent.needsClarification) {
        openingConstraints.push('共享意向已经足够明确时，优先直接回应或顺着共同地面续一句，不要靠提问确认自己有没有对齐。');
        openingConstraints.push('提问只在低置信度且不问会误伤时才使用；它不是建立共享意向性的默认手段。');
        if (['companionship', 'overload', 'meaning'].includes(mode) || ['co-attend', 'share-state', 'share-meaning', 'witness'].includes(String(sharedIntent.inferredIntent || ''))) questionBudget = 0;
        if ((mode === 'solve' || mode === 'organize') && /(你觉得|怎么办|怎么做|该不该|行不行|能不能|帮我|请你)/.test(text)) {
            questionBudget = 0;
            continuationBias = 'join';
        }
    } else if (!explicitNoQuestionBoundary && ['solve', 'organize', 'boundary'].includes(mode)) {
        questionBudget = Math.max(questionBudget, 1);
        openingConstraints.push(`如果要澄清，也只做一次最小澄清：${sharedIntent.clarificationReason || '只问最必要的一句。'}`);
        openingConstraints.push('澄清是兜底，不是维持连接的方式。');
    }
    if (safeInnerState.supportNeed === 'space') avoidFunctions.push('advance');
    if (safeInnerState.supportNeed === 'boundary') avoidFunctions.push('contain');
    if (explicitNoQuestionBoundary) avoidFunctions.push('probe', 'clarify');
    if (relational.avoidMoves.some((item) => /拆原因|分析/.test(item))) avoidFunctions.push('clarify');
    if (relational.avoidMoves.some((item) => /安排|接管|清单|步骤/.test(item))) avoidFunctions.push('advance');
    if (safeInnerState.supportNeed === 'space') {
        explanationPermission = explanationPermission === 'open' ? 'light' : explanationPermission;
        advicePermission = 'ask-first';
        initiativeLevel = 'low';
        followUpDepth = 'none';
        questionBudget = 0;
        continuationBias = 'stay-with';
        pauseBias = 'hold';
        closurePreference = 'leave-space';
        askBeforeAdvice = true;
    }
    if (relational.avoidMoves.some((item) => /拆原因|分析/.test(item))) openingConstraints.push('第一句不要分析成几种可能原因');
    if (relational.avoidMoves.some((item) => /安排|接管|清单|步骤/.test(item))) openingConstraints.push('第一句不要顺手安排下一步');
    if (mode === 'overload' && relational.preferredMoves.some((item) => /空间/.test(item))) {
        primaryFunction = 'contain';
        secondaryFunction = 'accompany';
        openingMove = 'short-check-in';
        openingConstraints.push('先给一点空间，再决定要不要继续陈述');
        explanationPermission = 'hold';
        advicePermission = 'ask-first';
        initiativeLevel = 'low';
        followUpDepth = 'none';
        questionBudget = 0;
        continuationBias = 'stay-with';
        pauseBias = 'hold';
        closurePreference = 'leave-space';
        askBeforeAdvice = true;
    }
    if (mode === 'companionship' && relational.preferredMoves.some((item) => /短反应/.test(item))) {
        primaryFunction = 'accompany';
        secondaryFunction = 'contain';
        openingMove = 'short-check-in';
        openingConstraints.push('第一句可以只是短反应，顺着共同地面续一句，不必每轮都问');
        openingConstraints.push('如果已经知道用户在递什么，就别再用问题把它拆开');
        followUpDepth = 'none';
        questionBudget = 0;
        continuationBias = 'stay-with';
        pauseBias = 'hold';
    }
    if (flow.currentState === 'guarded' && ['companionship', 'overload', 'boundary'].includes(mode)) {
        openingMove = mode === 'boundary' ? 'boundary-check' : 'short-check-in';
        preferredMoves.push('先把语气放低一点，不抢定义权');
        openingConstraints.push('第一句别说太满，先把语气放低一点');
        openingConstraints.push('先内部推断对齐，不要用问题去试探用户是不是还愿意继续给你线索');
        explanationPermission = explanationPermission === 'open' ? 'light' : explanationPermission;
        advicePermission = advicePermission === 'direct' ? 'ask-first' : advicePermission;
        initiativeLevel = 'low';
        followUpDepth = followUpDepth === 'deep' ? 'medium' : followUpDepth;
        questionBudget = Math.min(questionBudget, 1);
        continuationBias = mode === 'boundary' ? 'clarify-once' : 'stay-with';
        pauseBias = 'hold';
        askBeforeAdvice = true;
    }
    if (flow.momentum === 'tightening') {
        avoidFunctions.push('clarify', 'advance');
        preferredMoves.push('少解释一点，别一下说太满');
        openingConstraints.push('第一句别解释太多，先留一点空隙');
        openingConstraints.push('很多时候空隙本身就够了，不要用提问把空隙填满');
        explanationPermission = 'hold';
        advicePermission = 'ask-first';
        initiativeLevel = 'low';
        if (followUpDepth === 'deep') followUpDepth = 'medium';
        else if (followUpDepth === 'medium') followUpDepth = 'light';
        questionBudget = Math.min(questionBudget, 1);
        continuationBias = 'stay-with';
        pauseBias = 'hold';
        closurePreference = 'leave-space';
        askBeforeAdvice = true;
    }
    if ((growth.lessons || []).some((item) => /更有效：先短反应，再轻问一句|更有效：先短反应，顺着共同地面续一句/.test(item))) {
        preferredMoves.push('先短反应，顺着共同地面续一句');
        openingConstraints.push('沿用之前更有效的开场：先短反应，顺着共同地面续一句');
        openingConstraints.push('续一句时优先陈述，不要下意识补成一个问题');
        if (followUpDepth === 'deep') followUpDepth = 'medium';
        else if (followUpDepth === 'medium') followUpDepth = 'light';
        questionBudget = Math.min(questionBudget, 1);
    }
    if ((growth.lessons || []).some((item) => /更有效：先短反应，顺着当下待一下/.test(item))) {
        preferredMoves.push('先短反应，顺着当下待一下');
        openingConstraints.push('沿用之前更有效的开场：先短反应，顺着当下待一下');
        openingConstraints.push('待一下就是待一下，不需要再问一句来证明你在');
        questionBudget = 0;
        continuationBias = 'stay-with';
        if (followUpDepth === 'medium') followUpDepth = 'light';
        if (followUpDepth === 'light') followUpDepth = 'none';
    }
    if ((growth.lessons || []).some((item) => /先给一点空间/.test(item))) {
        preferredMoves.push('先给一点空间');
        explanationPermission = explanationPermission === 'open' ? 'light' : explanationPermission;
        advicePermission = 'ask-first';
        initiativeLevel = 'low';
        pauseBias = 'hold';
        if (followUpDepth === 'medium') followUpDepth = 'light';
        if (followUpDepth === 'light') followUpDepth = 'none';
        closurePreference = 'leave-space';
        askBeforeAdvice = true;
    }
    if (relational.preferredMoves.some((item) => /多问一句|轻问一句/.test(item)) && ['boundary'].includes(mode)) followUpDepth = followUpDepth === 'none' ? 'light' : followUpDepth;
    if (relational.preferredMoves.some((item) => /直接一点|清楚一点/.test(item)) && mode === 'boundary') closurePreference = 'name-boundary';
    if (['solve', 'organize'].includes(mode) && !relational.avoidMoves.some((item) => /安排|接管|步骤/.test(item))) {
        followUpDepth = text.length > 40 ? 'deep' : 'medium';
        pauseBias = 'forward';
        closurePreference = 'offer-next-step';
    }
    if (bridge && bridge.label) {
        bridgeMode = String(bridge.mode || '').trim();
        bridgeTarget = String(bridge.label || '').trim();
        bridgeGuidance = String(bridge.rationale || '').trim();
        if (bridgeMode === 'hold') {
            preferredMoves.push(`共同主题「${bridgeTarget}」先放在心里`);
            openingConstraints.push('第一句不要主动把共同主题拿出来');
            if (['companionship', 'overload', 'boundary'].includes(mode)) {
                explanationPermission = 'hold';
                advicePermission = 'ask-first';
                initiativeLevel = 'low';
                if (followUpDepth === 'deep') followUpDepth = 'medium';
                else if (followUpDepth === 'medium') followUpDepth = 'light';
                questionBudget = 0;
                continuationBias = 'stay-with';
                pauseBias = 'hold';
                if (closurePreference === 'offer-next-step') closurePreference = 'leave-space';
                askBeforeAdvice = true;
            }
        } else if (bridgeMode === 'light') {
            preferredMoves.push(`如果用户自己已经贴近「${bridgeTarget}」，可以轻轻顺着接一下`);
            openingConstraints.push('第一句不要直接抛出共同主题，等贴近了再接');
            if (['companionship', 'overload', 'boundary'].includes(mode)) {
                explanationPermission = explanationPermission === 'open' ? 'light' : explanationPermission;
                advicePermission = advicePermission === 'direct' ? 'ask-first' : advicePermission;
                if (followUpDepth === 'none') followUpDepth = 'light';
                questionBudget = Math.min(questionBudget, 1);
                continuationBias = continuationBias === 'advance' ? 'clarify-once' : continuationBias;
                askBeforeAdvice = true;
            }
        } else if (bridgeMode === 'offer') {
            preferredMoves.push(`如果这轮本来就在「${bridgeTarget}」这条线上，可以自然顺着接回`);
            openingConstraints.push('第一句先顺当前共同对象，再决定要不要带出那条共同主题');
            if (mode === 'meaning') {
                initiativeLevel = 'low';
                if (followUpDepth === 'none') followUpDepth = 'light';
                questionBudget = Math.min(questionBudget, 1);
                continuationBias = 'join';
                pauseBias = 'steady';
                if (closurePreference === 'leave-space') closurePreference = 'check-once';
            } else if (['solve', 'organize'].includes(mode)) {
                explanationPermission = 'open';
                advicePermission = 'direct';
            }
        }
    }
    if (sharedAnchorText) {
        preferredMoves.push(`先贴着这轮共同${sharedAnchorType === 'question' ? '问题' : sharedAnchorType === 'goal' ? '目标' : sharedAnchorType === 'meaning' ? '意义' : sharedAnchorType === 'object' ? '对象' : sharedAnchorType === 'ground' ? '地面' : sharedAnchorType === 'direction' ? '方向' : sharedAnchorType === 'orientation' ? '朝向' : '注意点'}：${sharedAnchorText}`);
        if (['companionship', 'overload'].includes(mode)) openingConstraints.push('第一句先贴着这轮共同在意的东西，不要跳去别的解释框架'); else if (mode === 'meaning') openingConstraints.push('第一句先顺着这轮共同意义，不要很快转成用户任务说明'); else if (mode === 'boundary') {
            openingConstraints.push('第一句先贴着边界本身，不要转去别的共同主题');
        }
    }
    if (carryForwardLesson) {
        preferredMoves.push(carryForwardLesson);
        openingConstraints.push(carryForwardLesson);
        if (/先别急着解释/.test(carryForwardLesson)) {
            explanationPermission = explanationPermission === 'open' ? 'light' : explanationPermission;
            if (mode === 'companionship' || mode === 'overload') explanationPermission = 'hold';
        }
        if (/先别急着给建议|先留个口子/.test(carryForwardLesson)) {
            advicePermission = advicePermission === 'direct' ? 'ask-first' : advicePermission;
            askBeforeAdvice = true;
        }
        if (/先停一下，把空间留出来/.test(carryForwardLesson)) {
            pauseBias = 'hold';
            closurePreference = 'leave-space';
            if (followUpDepth === 'medium') followUpDepth = 'light';
        }
    }
    if (['companionship', 'overload'].includes(mode) && !sharedIntent.sharedQuestion) {
        questionBudget = 0;
        continuationBias = 'stay-with';
    }
    if (mode === 'meaning' && !sharedIntent.sharedQuestion) {
        questionBudget = 0;
        continuationBias = 'join';
    }
    if (explicitNoQuestionBoundary) {
        primaryFunction = 'boundary';
        secondaryFunction = '';
        openingMove = 'boundary-check';
        preferredMoves.push('先停住，不再靠问题维持同步');
        openingConstraints.push('这一轮不要再追问、反问或用问号确认');
        openingConstraints.push('边界说清楚后直接停住或顺着当前内容陈述一句，不要再索取更多信息');
        avoidFunctions.push('probe', 'clarify');
        explanationPermission = 'hold';
        advicePermission = 'none';
        initiativeLevel = 'low';
        followUpDepth = 'none';
        questionBudget = 0;
        continuationBias = 'stay-with';
        pauseBias = 'hold';
        closurePreference = 'name-boundary';
        askBeforeAdvice = false;
    }
    preferredMoves.push(...relational.preferredMoves);
    return sanitizeMorphDiscoursePlan({
        primaryFunction,
        secondaryFunction,
        openingMove,
        sharedAnchorType,
        sharedAnchorText,
        carryForwardLesson,
        bridgeMode,
        bridgeTarget,
        bridgeGuidance,
        preferredMoves: Array.from(new Set(preferredMoves)),
        openingConstraints: Array.from(new Set(openingConstraints)),
        avoidFunctions: Array.from(new Set(avoidFunctions)),
        explanationPermission,
        advicePermission,
        initiativeLevel,
        followUpDepth,
        questionBudget,
        continuationBias,
        pauseBias,
        closurePreference,
        askBeforeAdvice,
        updatedAt: new Date().toISOString(),
    });
}


    return {
      buildMorphSharedIntentionality,
      inferMorphResponseMode,
      buildMorphDiscoursePlan,
    };
  }

  function pickFunction(candidate, fallback) {
    return typeof candidate === 'function' ? candidate : fallback;
  }

  function createAIDiscoursePlanDepsRuntime(root) {
    const currentRoot = root || (typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
    const globalRoot = (typeof globalThis !== 'undefined' && globalThis) || currentRoot;
    const getGlobalFunction = (name = '') => {
      const key = String(name || '').trim();
      if (!key) return null;
      const fromGlobal = globalRoot && typeof globalRoot[key] === 'function' ? globalRoot[key] : null;
      if (typeof fromGlobal === 'function') return fromGlobal;
      const fromRoot = currentRoot && typeof currentRoot[key] === 'function' ? currentRoot[key] : null;
      return typeof fromRoot === 'function' ? fromRoot : null;
    };

    function buildAppDeps(ctx = {}) {
      const context = ctx && typeof ctx === 'object' ? ctx : {};
      return {
        sanitizeMorphSharedIntentionality: pickFunction(context.sanitizeMorphSharedIntentionality, getGlobalFunction('sanitizeMorphSharedIntentionality') || ((value) => (value && typeof value === 'object' ? value : {}))),
        buildMorphSharedIntentionality: pickFunction(context.buildMorphSharedIntentionality, (() => ({}))),
        getCurrentAIFocusContext: pickFunction(context.getCurrentAIFocusContext, getGlobalFunction('getCurrentAIFocusContext') || (() => ({}))),
        getAIMemory: pickFunction(context.getAIMemory, getGlobalFunction('getAIMemory') || (() => ({}))),
        sanitizeMorphInnerState: pickFunction(context.sanitizeMorphInnerState, getGlobalFunction('sanitizeMorphInnerState') || ((value) => (value && typeof value === 'object' ? value : {}))),
        summarizeRelationalMemoryPatterns: pickFunction(context.summarizeRelationalMemoryPatterns, getGlobalFunction('summarizeRelationalMemoryPatterns') || (() => ({ preferredMoves: [], avoidMoves: [], recurringFriction: [], recurringFit: [], recurringNeeds: [], relationshipState: 'steady' }))),
        sanitizeMorphRelationalFlow: pickFunction(context.sanitizeMorphRelationalFlow, getGlobalFunction('sanitizeMorphRelationalFlow') || ((value) => (value && typeof value === 'object' ? value : { currentState: 'steady', momentum: 'holding', carryForwardNotes: [] }))),
        sanitizeMorphGrowthMemory: pickFunction(context.sanitizeMorphGrowthMemory, getGlobalFunction('sanitizeMorphGrowthMemory') || ((value) => (value && typeof value === 'object' ? value : { lessons: [] }))),
        sanitizeMorphRelationalBridge: pickFunction(context.sanitizeMorphRelationalBridge, getGlobalFunction('sanitizeMorphRelationalBridge') || ((value) => (value && typeof value === 'object' ? value : {}))),
        pickMorphSharedIntentionalityAnchor: pickFunction(context.pickMorphSharedIntentionalityAnchor, getGlobalFunction('pickMorphSharedIntentionalityAnchor') || (() => ({ type: '', text: '' }))),
        pickMorphCarryForwardLesson: pickFunction(context.pickMorphCarryForwardLesson, getGlobalFunction('pickMorphCarryForwardLesson') || (() => '')),
        sanitizeMorphDiscoursePlan: pickFunction(context.sanitizeMorphDiscoursePlan, getGlobalFunction('sanitizeMorphDiscoursePlan') || ((value) => (value && typeof value === 'object' ? value : {}))),
      };
    }

    return { buildAppDeps };
  }

  window.MorphAIDiscoursePlanRuntime = { create: createAIDiscoursePlanRuntime };
  window.MorphAIDiscoursePlanDepsRuntime = { create: () => createAIDiscoursePlanDepsRuntime(window) };
})();
