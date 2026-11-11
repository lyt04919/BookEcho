import { BookItem, AnnotationItem, AppleBooksReadingStats } from '../../electron/types/ipc';

export const DEMO_BOOKS: BookItem[] = [
  {
    assetId: 'demo-book-naval',
    title: '纳瓦尔宝典',
    author: '埃里克·乔根森',
    genre: '商业 / 认知思维',
    readingProgress: 0.92,
    epubPath: '/demo/naval.epub',
    coverUrl: null,
    highlightsCount: 5,
    lastOpenDateMs: Date.now() - 1000 * 3600 * 4
  },
  {
    assetId: 'demo-book-munger',
    title: '穷查理宝典',
    author: '查理·芒格',
    genre: '投资 / 哲学',
    readingProgress: 0.88,
    epubPath: '/demo/munger.epub',
    coverUrl: null,
    highlightsCount: 4,
    lastOpenDateMs: Date.now() - 1000 * 3600 * 12
  },
  {
    assetId: 'demo-book-principles',
    title: '原则：生活与工作',
    author: '瑞·达利欧',
    genre: '管理 / 系统思维',
    readingProgress: 0.75,
    epubPath: '/demo/principles.epub',
    coverUrl: null,
    highlightsCount: 4,
    lastOpenDateMs: Date.now() - 1000 * 3600 * 36
  },
  {
    assetId: 'demo-book-antifragile',
    title: '反脆弱：从不确定性中获益',
    author: '纳西姆·塔勒布',
    genre: '哲学 / 复杂系统',
    readingProgress: 0.64,
    epubPath: '/demo/antifragile.epub',
    coverUrl: null,
    highlightsCount: 3,
    lastOpenDateMs: Date.now() - 1000 * 3600 * 48
  },
  {
    assetId: 'demo-book-habits',
    title: '原子习惯：微小改变带来巨大飞跃',
    author: '詹姆斯·克利尔',
    genre: '自我提升 / 行为学',
    readingProgress: 1.0,
    epubPath: '/demo/habits.epub',
    coverUrl: null,
    highlightsCount: 3,
    lastOpenDateMs: Date.now() - 1000 * 3600 * 72
  },
  {
    assetId: 'demo-book-kahneman',
    title: '思考，快与慢',
    author: '丹尼尔·卡尼曼',
    genre: '心理学 / 行为经济学',
    readingProgress: 0.82,
    epubPath: '/demo/kahneman.epub',
    coverUrl: null,
    highlightsCount: 3,
    lastOpenDateMs: Date.now() - 1000 * 3600 * 96
  }
];

export const DEMO_TAGS: string[] = [
  '心智模型',
  '认知',
  '系统思维',
  '商业思考',
  '复利',
  '决策',
  '习惯',
  '反脆弱'
];

export const DEMO_ANNOTATIONS: AnnotationItem[] = [
  // 1. 纳瓦尔宝典
  {
    uuid: 'demo-anno-naval-1',
    assetId: 'demo-book-naval',
    bookTitle: '纳瓦尔宝典',
    selectedText: '致富不是靠运气，而是靠技能。如果你有一千次重新开始的机会，你每一次都能变富有。',
    note: '可复制的认知复利资产',
    representativeText: '致富不是靠运气',
    colorKey: 'yellow',
    locationCfi: 'epubcfi(/6/2[chap1]!/4/2/10)',
    chapterTitle: '第一章 积累财富',
    creationDateMs: Date.now() - 1000 * 3600 * 24 * 5,
    modificationDateMs: Date.now() - 1000 * 3600 * 24 * 3,
    sortIndex: 1,
    customNote: '真正的财富是能够在睡梦中持续产生现金流的资产，而非拿时间换金钱。',
    isStarred: true,
    tags: ['商业思考', '心智模型', '复利']
  },
  {
    uuid: 'demo-anno-naval-2',
    assetId: 'demo-book-naval',
    bookTitle: '纳瓦尔宝典',
    selectedText: '建立独特的专长，然后用杠杆放大它。代码和媒体是不需要他人许可的杠杆。',
    note: '现代边际成本为零的杠杆',
    representativeText: '建立独特的专长',
    colorKey: 'green',
    locationCfi: 'epubcfi(/6/2[chap1]!/4/2/20)',
    chapterTitle: '第一章 积累财富',
    creationDateMs: Date.now() - 1000 * 3600 * 24 * 6,
    modificationDateMs: Date.now() - 1000 * 3600 * 24 * 4,
    sortIndex: 2,
    customNote: '软件开发者和内容创作者拥有工业时代无法想象的无限复制杠杆。',
    isStarred: true,
    tags: ['商业思考', '认知']
  },
  {
    uuid: 'demo-anno-naval-3',
    assetId: 'demo-book-naval',
    bookTitle: '纳瓦尔宝典',
    selectedText: '如果你吃得健康、睡得好、经常锻炼、心态平和，你就会过上好日子。',
    note: '最基础的底层健康闭环',
    representativeText: null,
    colorKey: 'pink',
    locationCfi: 'epubcfi(/6/4[chap3]!/4/2/8)',
    chapterTitle: '第三章 增强幸福感',
    creationDateMs: Date.now() - 1000 * 3600 * 24 * 8,
    modificationDateMs: Date.now() - 1000 * 3600 * 24 * 7,
    sortIndex: 3,
    customNote: '精力是所有高级心智运算和决策的物质基石。',
    isStarred: false,
    tags: ['习惯', '认知']
  },
  {
    uuid: 'demo-anno-naval-4',
    assetId: 'demo-book-naval',
    bookTitle: '纳瓦尔宝典',
    selectedText: '学习基础的微观经济学、博弈论、心理学、说服力、伦理学、数学和计算机。',
    note: '跨学科底层心智模型清单',
    representativeText: null,
    colorKey: 'blue',
    locationCfi: 'epubcfi(/6/2[chap1]!/4/2/35)',
    chapterTitle: '第一章 积累财富',
    creationDateMs: Date.now() - 1000 * 3600 * 24 * 10,
    modificationDateMs: Date.now() - 1000 * 3600 * 24 * 9,
    sortIndex: 4,
    customNote: '这与查理·芒格提倡的多元思维模型体系完全一致。',
    isStarred: true,
    tags: ['心智模型', '认知', '决策']
  },
  {
    uuid: 'demo-anno-naval-5',
    assetId: 'demo-book-naval',
    bookTitle: '纳瓦尔宝典',
    selectedText: '在人际关系和事业中，复利效应无处不在。找到好的人和对的方向，长久合作下去。',
    note: '信誉与关系的复利',
    representativeText: null,
    colorKey: 'yellow',
    locationCfi: 'epubcfi(/6/2[chap1]!/4/2/42)',
    chapterTitle: '第一章 积累财富',
    creationDateMs: Date.now() - 1000 * 3600 * 24 * 12,
    modificationDateMs: Date.now() - 1000 * 3600 * 24 * 11,
    sortIndex: 5,
    customNote: '复利不仅适用于金钱，最强大的复利是声誉与信任。',
    isStarred: false,
    tags: ['复利', '商业思考']
  },

  // 2. 穷查理宝典
  {
    uuid: 'demo-anno-munger-1',
    assetId: 'demo-book-munger',
    bookTitle: '穷查理宝典',
    selectedText: '反过来想，总是反过来想。想知道人生如何得到幸福，先研究人生如何才能变得痛苦。',
    note: '雅可比逆向思考法则',
    representativeText: '反过来想，总是反过来想',
    colorKey: 'blue',
    locationCfi: 'epubcfi(/6/4[chap2]!/4/2/15)',
    chapterTitle: '第二讲 芒格论多元思维模型',
    creationDateMs: Date.now() - 1000 * 3600 * 24 * 14,
    modificationDateMs: Date.now() - 1000 * 3600 * 24 * 13,
    sortIndex: 1,
    customNote: '避免愚蠢比争取极度聪明容易得多，逆向避坑才是最高胜率策略。',
    isStarred: true,
    tags: ['心智模型', '决策', '认知']
  },
  {
    uuid: 'demo-anno-munger-2',
    assetId: 'demo-book-munger',
    bookTitle: '穷查理宝典',
    selectedText: '在手里拿着铁锤的人看来，世界上的每个问题都长得像一颗钉子。',
    note: '铁锤人单一视角谬误',
    representativeText: '铁锤人综合征',
    colorKey: 'pink',
    locationCfi: 'epubcfi(/6/4[chap2]!/4/2/22)',
    chapterTitle: '第二讲 芒格论多元思维模型',
    creationDateMs: Date.now() - 1000 * 3600 * 24 * 15,
    modificationDateMs: Date.now() - 1000 * 3600 * 24 * 14,
    sortIndex: 2,
    customNote: '单一专业学科专家的盲区，必须掌握 80 到 90 个重要心智模型来织成认知格栅。',
    isStarred: true,
    tags: ['心智模型', '认知']
  },
  {
    uuid: 'demo-anno-munger-3',
    assetId: 'demo-book-munger',
    bookTitle: '穷查理宝典',
    selectedText: '只要做好准备，当好机会来临时，就狠狠地下重注，其余时间则安安静静地等待。',
    note: '赔率与胜率意识',
    representativeText: null,
    colorKey: 'green',
    locationCfi: 'epubcfi(/6/6[chap3]!/4/2/30)',
    chapterTitle: '第三讲 论基本的、普世的智慧',
    creationDateMs: Date.now() - 1000 * 3600 * 24 * 18,
    modificationDateMs: Date.now() - 1000 * 3600 * 24 * 17,
    sortIndex: 3,
    customNote: '克制与耐心是顶级投资者的核心美德。',
    isStarred: false,
    tags: ['商业思考', '决策']
  },
  {
    uuid: 'demo-anno-munger-4',
    assetId: 'demo-book-munger',
    bookTitle: '穷查理宝典',
    selectedText: '要得到你想要的东西，最可靠的办法是让自己配得上拥有它。',
    note: '黄金配得感法则',
    representativeText: null,
    colorKey: 'yellow',
    locationCfi: 'epubcfi(/6/8[chap4]!/4/2/5)',
    chapterTitle: '第四讲 论哈佛毕业典礼',
    creationDateMs: Date.now() - 1000 * 3600 * 24 * 20,
    modificationDateMs: Date.now() - 1000 * 3600 * 24 * 19,
    sortIndex: 4,
    customNote: '自我价值决定终局匹配度，而非向外索取。',
    isStarred: true,
    tags: ['认知', '心智模型']
  },

  // 3. 原则
  {
    uuid: 'demo-anno-principles-1',
    assetId: 'demo-book-principles',
    bookTitle: '原则：生活与工作',
    selectedText: '痛苦 + 反思 = 进步。痛苦是现实给你的信号，提醒你有些东西需要被优化和重塑。',
    note: '达利欧核心成长公式',
    representativeText: '痛苦 + 反思 = 进步',
    colorKey: 'yellow',
    locationCfi: 'epubcfi(/6/2[part1]!/4/2/12)',
    chapterTitle: '第二部分 生命原则',
    creationDateMs: Date.now() - 1000 * 3600 * 24 * 22,
    modificationDateMs: Date.now() - 1000 * 3600 * 24 * 21,
    sortIndex: 1,
    customNote: '逃避痛苦就会逃避成长，拥抱现实并把错误当成迭代的样本。',
    isStarred: true,
    tags: ['心智模型', '系统思维', '认知']
  },
  {
    uuid: 'demo-anno-principles-2',
    assetId: 'demo-book-principles',
    bookTitle: '原则：生活与工作',
    selectedText: '极度开放的头脑和极度透明。向最有资格的反对者请教，寻找认知的盲点。',
    note: '可信度加权决策',
    representativeText: null,
    colorKey: 'green',
    locationCfi: 'epubcfi(/6/2[part1]!/4/2/25)',
    chapterTitle: '第二部分 生命原则',
    creationDateMs: Date.now() - 1000 * 3600 * 24 * 25,
    modificationDateMs: Date.now() - 1000 * 3600 * 24 * 24,
    sortIndex: 2,
    customNote: '消除小我（Ego），追求事实真实胜过自己所谓的“面子”。',
    isStarred: false,
    tags: ['认知', '决策']
  },
  {
    uuid: 'demo-anno-principles-3',
    assetId: 'demo-book-principles',
    bookTitle: '原则：生活与工作',
    selectedText: '将你的生活想象成一部机器，你既是操作机器的工人，也是设计这台机器的工程师。',
    note: '高维机器视角',
    representativeText: null,
    colorKey: 'blue',
    locationCfi: 'epubcfi(/6/4[part2]!/4/2/18)',
    chapterTitle: '第三部分 工作原则',
    creationDateMs: Date.now() - 1000 * 3600 * 24 * 28,
    modificationDateMs: Date.now() - 1000 * 3600 * 24 * 27,
    sortIndex: 3,
    customNote: '跳出局中人的执行视角，从系统架构师的角度审视输入、算法和反馈。',
    isStarred: true,
    tags: ['系统思维', '心智模型']
  },
  {
    uuid: 'demo-anno-principles-4',
    assetId: 'demo-book-principles',
    bookTitle: '原则：生活与工作',
    selectedText: '进化是宇宙中最强大的力量，是唯一永恒的事情，它驱动着一切。',
    note: '终极宏观法则',
    representativeText: null,
    colorKey: 'purple',
    locationCfi: 'epubcfi(/6/2[part1]!/4/2/40)',
    chapterTitle: '第二部分 生命原则',
    creationDateMs: Date.now() - 1000 * 3600 * 24 * 30,
    modificationDateMs: Date.now() - 1000 * 3600 * 24 * 29,
    sortIndex: 4,
    customNote: '不适应现实进化的系统终将瓦解。',
    isStarred: false,
    tags: ['系统思维']
  },

  // 4. 反脆弱
  {
    uuid: 'demo-anno-antifragile-1',
    assetId: 'demo-book-antifragile',
    bookTitle: '反脆弱：从不确定性中获益',
    selectedText: '风会熄灭蜡烛，却能使火越烧越旺。你愿意做蜡烛还是做火焰？',
    note: '脆弱与反脆弱的生动隐喻',
    representativeText: '风会熄灭蜡烛，却能使火越烧越旺',
    colorKey: 'pink',
    locationCfi: 'epubcfi(/6/2[intro]!/4/2/2)',
    chapterTitle: '前言：反脆弱性导论',
    creationDateMs: Date.now() - 1000 * 3600 * 24 * 32,
    modificationDateMs: Date.now() - 1000 * 3600 * 24 * 31,
    sortIndex: 1,
    customNote: '反脆弱超越了坚韧（Resilient），坚韧只是保持原状，而反脆弱是在压力中不断增强进化。',
    isStarred: true,
    tags: ['反脆弱', '系统思维', '心智模型']
  },
  {
    uuid: 'demo-anno-antifragile-2',
    assetId: 'demo-book-antifragile',
    bookTitle: '反脆弱：从不确定性中获益',
    selectedText: '采用杠铃策略（Barbell Strategy）：在某些领域极度保守，而在另一端进行小规模积极试错。',
    note: '不对称风险敞口设计',
    representativeText: null,
    colorKey: 'green',
    locationCfi: 'epubcfi(/6/6[chap5]!/4/2/18)',
    chapterTitle: '第五章 杠铃策略',
    creationDateMs: Date.now() - 1000 * 3600 * 24 * 35,
    modificationDateMs: Date.now() - 1000 * 3600 * 24 * 34,
    sortIndex: 2,
    customNote: '下行风险有底线锁定，上行收益具有无限凸性（Convexity）。',
    isStarred: true,
    tags: ['反脆弱', '决策', '商业思考']
  },
  {
    uuid: 'demo-anno-antifragile-3',
    assetId: 'demo-book-antifragile',
    bookTitle: '反脆弱：从不确定性中获益',
    selectedText: '过度保护反而制造脆弱。如果剥夺有机体的小压力，系统就会在面对大冲击时彻底崩溃。',
    note: '过度干预的医源性损伤',
    representativeText: null,
    colorKey: 'yellow',
    locationCfi: 'epubcfi(/6/4[chap3]!/4/2/12)',
    chapterTitle: '第三章 医源性损伤与有机体',
    creationDateMs: Date.now() - 1000 * 3600 * 24 * 38,
    modificationDateMs: Date.now() - 1000 * 3600 * 24 * 37,
    sortIndex: 3,
    customNote: '适度暴露于压力和随机性中，才是生命系统的天然保鲜剂。',
    isStarred: false,
    tags: ['反脆弱', '认知']
  },

  // 5. 原子习惯
  {
    uuid: 'demo-anno-habits-1',
    assetId: 'demo-book-habits',
    bookTitle: '原子习惯：微小改变带来巨大飞跃',
    selectedText: '每天进步1%，一年之后你将进步37倍；每天退步1%，一年之后你将几乎降为零。',
    note: '习惯复利的数学真理',
    representativeText: '1% 习惯复利公式',
    colorKey: 'yellow',
    locationCfi: 'epubcfi(/6/2[chap1]!/4/2/5)',
    chapterTitle: '第一章 微习惯的惊人力量',
    creationDateMs: Date.now() - 1000 * 3600 * 24 * 40,
    modificationDateMs: Date.now() - 1000 * 3600 * 24 * 39,
    sortIndex: 1,
    customNote: '习惯是自我提高的复利，微小调整的时间积分具有核聚变级的威力。',
    isStarred: true,
    tags: ['习惯', '复利', '心智模型']
  },
  {
    uuid: 'demo-anno-habits-2',
    assetId: 'demo-book-habits',
    bookTitle: '原子习惯：微小改变带来巨大飞跃',
    selectedText: '决定你成功的不是你设定的目标，而是你遵循的系统。目标只是方向，系统才是进度。',
    note: '系统导向 vs 目标导向',
    representativeText: null,
    colorKey: 'blue',
    locationCfi: 'epubcfi(/6/2[chap1]!/4/2/16)',
    chapterTitle: '第一章 微习惯的惊人力量',
    creationDateMs: Date.now() - 1000 * 3600 * 24 * 42,
    modificationDateMs: Date.now() - 1000 * 3600 * 24 * 41,
    sortIndex: 2,
    customNote: '达利欧机器论在微观个人生活层面的完美投射。',
    isStarred: true,
    tags: ['习惯', '系统思维']
  },
  {
    uuid: 'demo-anno-habits-3',
    assetId: 'demo-book-habits',
    bookTitle: '原子习惯：微小改变带来巨大飞跃',
    selectedText: '改变习惯最有效的方法不是关注你想要达到什么，而是关注你想成为什么样的人（身份认同）。',
    note: '基于身份认同的习惯重塑',
    representativeText: null,
    colorKey: 'green',
    locationCfi: 'epubcfi(/6/4[chap2]!/4/2/9)',
    chapterTitle: '第二章 习惯如何塑造你的身份',
    creationDateMs: Date.now() - 1000 * 3600 * 24 * 45,
    modificationDateMs: Date.now() - 1000 * 3600 * 24 * 44,
    sortIndex: 3,
    customNote: '每一次微小的行动都是在为你想要成为的那种人投上一票。',
    isStarred: false,
    tags: ['习惯', '认知']
  },

  // 6. 思考，快与慢
  {
    uuid: 'demo-anno-kahneman-1',
    assetId: 'demo-book-kahneman',
    bookTitle: '思考，快与慢',
    selectedText: '系统1的运行是无意识且快速的，不怎么费脑力；系统2则将注意力分配到需要耗费脑力的复杂运算上来。',
    note: '双系统双轨心智架构',
    representativeText: '两套认知系统',
    colorKey: 'blue',
    locationCfi: 'epubcfi(/6/2[part1]!/4/2/10)',
    chapterTitle: '第一部分 两套系统',
    creationDateMs: Date.now() - 1000 * 3600 * 24 * 48,
    modificationDateMs: Date.now() - 1000 * 3600 * 24 * 47,
    sortIndex: 1,
    customNote: '人类大多数直觉偏误源于系统1的自动化启发式假定没有被系统2审慎干预。',
    isStarred: true,
    tags: ['认知', '决策', '心智模型']
  },
  {
    uuid: 'demo-anno-kahneman-2',
    assetId: 'demo-book-kahneman',
    bookTitle: '思考，快与慢',
    selectedText: '看见的即是全部（WYSIATI 原则）。过度自信是由我们构建连贯故事的轻松程度决定的，而非信息的质量。',
    note: 'WYSIATI 认知偏误',
    representativeText: null,
    colorKey: 'purple',
    locationCfi: 'epubcfi(/6/2[part1]!/4/2/25)',
    chapterTitle: '第七章 机制的运作：看见的即是全部',
    creationDateMs: Date.now() - 1000 * 3600 * 24 * 50,
    modificationDateMs: Date.now() - 1000 * 3600 * 24 * 49,
    sortIndex: 2,
    customNote: '脑海中的故事越连贯，我们越容易误以为自己掌握了全局真相。',
    isStarred: true,
    tags: ['认知', '决策']
  },
  {
    uuid: 'demo-anno-kahneman-3',
    assetId: 'demo-book-kahneman',
    bookTitle: '思考，快与慢',
    selectedText: '损失厌恶心理：面对同样的得失幅度，人们对损失的痛苦感受大约是对获得快乐感受的两倍。',
    note: '前景理论核心：损失厌恶',
    representativeText: null,
    colorKey: 'yellow',
    locationCfi: 'epubcfi(/6/6[part4]!/4/2/14)',
    chapterTitle: '第二十八章 损失厌恶',
    creationDateMs: Date.now() - 1000 * 3600 * 24 * 52,
    modificationDateMs: Date.now() - 1000 * 3600 * 24 * 51,
    sortIndex: 3,
    customNote: '与商业决策中的沉没成本谬误及达利欧、芒格的不对称赔率思考深度联动。',
    isStarred: false,
    tags: ['商业思考', '决策', '认知']
  }
];

function buildDemoReadingStats(): AppleBooksReadingStats {
  const sampleMinutes = [25, 18, 42, 0, 35, 50, 15, 28, 32, 0, 45, 22, 38, 19];
  const today = new Date();
  const dailyHistory = sampleMinutes
    .map((mins, idx) => {
      const d = new Date(today.getTime() - (sampleMinutes.length - 1 - idx) * 86400000);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const sec = mins * 60;
      return {
        date: `${yyyy}-${mm}-${dd}`,
        readingTimeSec: sec,
        readingGoalSec: 1200,
        goalMet: sec >= 1200
      };
    })
    .filter(d => d.readingTimeSec > 0);

  const totalReadingSec = dailyHistory.reduce((s, d) => s + d.readingTimeSec, 0);
  const todayReadingSec = dailyHistory[dailyHistory.length - 1]?.readingTimeSec || 0;

  return {
    available: true,
    todayReadingSec,
    dailyGoalSec: 1200,
    currentStreakDays: 4,
    allTimeRecordStreakDays: 9,
    currentYearBooksFinished: 6,
    yearlyBooksFinishedGoal: 12,
    totalReadingSec,
    dailyHistory
  };
}

export const DEMO_READING_STATS: AppleBooksReadingStats = buildDemoReadingStats();
