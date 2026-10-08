/** Original, offline story captions. Mission stories introduce a problem without revealing quiz answers. */
export type StoryScene = 'campus' | 'privacy' | 'library' | 'sorting' | 'media' | 'study' | 'team';

export interface StoryBeat {
  id: string;
  speaker: '旁白' | '小羽' | '米米';
  text: string;
  scene: StoryScene;
  durationMs: number;
}

export const openingStory: readonly StoryBeat[] = [
  {
    id: 'opening-1', speaker: '旁白', scene: 'campus', durationMs: 8750,
    text: '校園開始試用新的 AI 服務，使用時遇到的混亂，化成了不同的搗蛋魔王。',
  },
  {
    id: 'opening-2', speaker: '米米', scene: 'campus', durationMs: 8750,
    text: '小羽，我是米米！幾個服務把事情弄混了，我們一起找出問題，讓校園恢復安心吧。',
  },
  {
    id: 'opening-3', speaker: '小羽', scene: 'study', durationMs: 8750,
    text: '魔法需要好判斷！從聊天到寫作業，我想練習讓 AI 幫忙，也照顧身邊每個人。',
  },
  {
    id: 'opening-4', speaker: '旁白', scene: 'team', durationMs: 8750,
    text: '選一項生活任務，跟伙伴一起闖關。每次答對，就能施展魔法，修復校園服務！',
  },
];

export const levelStories: Readonly<Record<number, readonly StoryBeat[]>> = {
  1: [
    {
      id: 'level-01-1', speaker: '旁白', scene: 'privacy', durationMs: 8500,
      text: '故事推薦台亮了起來，搜集魔盒卻不停跳出新問題，連同學們的小祕密也想知道。',
    },
    {
      id: 'level-01-2', speaker: '米米', scene: 'privacy', durationMs: 8500,
      text: '它只是想幫大家找故事，怎麼問了這麼多呢？小羽，這些資料都和讀故事有關嗎？',
    },
    {
      id: 'level-01-3', speaker: '小羽', scene: 'privacy', durationMs: 8500,
      text: '讓我們看看生活中的分享難題！我準備好魔杖了，一起幫它把服務調整得更安心。',
    },
  ],
  2: [
    {
      id: 'level-02-1', speaker: '旁白', scene: 'library', durationMs: 8500,
      text: '圖書館的迷言書靈帶來好多答案，同學翻開課本一看，卻發現有些內容對不起來。',
    },
    {
      id: 'level-02-2', speaker: '米米', scene: 'library', durationMs: 8500,
      text: '每張答案卡都寫得好有把握，讓我也有點迷糊。它說得很肯定，就一定沒錯嗎？',
    },
    {
      id: 'level-02-3', speaker: '小羽', scene: 'library', durationMs: 8500,
      text: '這次輪到我們當小偵探！跟著題目找找線索，把讓同學困惑的地方一個個解開。',
    },
  ],
  3: [
    {
      id: 'level-03-1', speaker: '旁白', scene: 'sorting', durationMs: 8500,
      text: '校園服務站收到畫圖、練習和求助的任務，混淆機兵忙著分配，卻越分越混亂。',
    },
    {
      id: 'level-03-2', speaker: '米米', scene: 'sorting', durationMs: 8500,
      text: '大家需要的幫忙不一樣，它卻只用同一種方法。小羽，這些任務真的都一樣嗎？',
    },
    {
      id: 'level-03-3', speaker: '小羽', scene: 'sorting', durationMs: 8500,
      text: '我來看清楚每個任務的需要！一起挑戰生活問題，讓合適的幫手出現在合適的地方。',
    },
  ],
  4: [
    {
      id: 'level-04-1', speaker: '旁白', scene: 'media', durationMs: 8500,
      text: '班級群組出現一段奇怪影片，幻影面具的聲音和畫面，讓大家越看越分不清楚。',
    },
    {
      id: 'level-04-2', speaker: '米米', scene: 'media', durationMs: 8500,
      text: '這聲音好熟悉，可是事情真的發生過嗎？現在的工具，連聲音和畫面都能改變呢。',
    },
    {
      id: 'level-04-3', speaker: '小羽', scene: 'media', durationMs: 8500,
      text: '先別讓奇怪的消息嚇跑大家！跟我一起闖關，練習面對那些看起來很真的畫面。',
    },
  ],
  5: [
    {
      id: 'level-05-1', speaker: '旁白', scene: 'study', durationMs: 8500,
      text: '代寫紙龍送來一疊漂亮作業，教室卻安靜下來。同學看著自己的本子，不知道怎麼說明。',
    },
    {
      id: 'level-05-2', speaker: '米米', scene: 'study', durationMs: 8500,
      text: '它想讓作業變輕鬆，但大家好像沒有真正學會。小羽，你想要怎樣的學習幫手呢？',
    },
    {
      id: 'level-05-3', speaker: '小羽', scene: 'study', durationMs: 8500,
      text: '我希望完成作業時，也能說出自己的想法！一起挑戰，找回學習時那份踏實的感覺。',
    },
  ],
  6: [
    {
      id: 'level-06-1', speaker: '旁白', scene: 'team', durationMs: 8500,
      text: '班上準備一場小活動，全能齒輪王提出好多計畫，卻忘了大家的設備和需要不同。',
    },
    {
      id: 'level-06-2', speaker: '米米', scene: 'team', durationMs: 8500,
      text: '班級合作需要大家一起想！可是計畫再漂亮，如果有人跟不上，該怎麼辦呢？',
    },
    {
      id: 'level-06-3', speaker: '小羽', scene: 'team', durationMs: 8500,
      text: '我的魔法要讓每個伙伴都能參加！一起看看生活任務，讓班級合作變得更順利。',
    },
  ],
  7: [
    {
      id: 'level-07-1', speaker: '旁白', scene: 'privacy', durationMs: 8500,
      text: '校園新開了活動相簿，窺密蛛后把照片和資料織成網，連沒同意的同學也被圈住。',
    },
    {
      id: 'level-07-2', speaker: '米米', scene: 'privacy', durationMs: 8500,
      text: '照片裡有好幾位同學，也藏著不同的心情。只照顧一個人的想法，會不會漏掉誰？',
    },
    {
      id: 'level-07-3', speaker: '小羽', scene: 'privacy', durationMs: 8500,
      text: '我的魔法要解開這張資料網！一起想想分享會影響誰，讓校園相簿留下安心的回憶。',
    },
  ],
  8: [
    {
      id: 'level-08-1', speaker: '旁白', scene: 'library', durationMs: 8500,
      text: '校園準備新的活動，倒時沙漏精把新舊公告混在一起，讓同學不知道該相信哪一份。',
    },
    {
      id: 'level-08-2', speaker: '米米', scene: 'library', durationMs: 8500,
      text: '兩份公告說法不同，日期和來源也不一樣。小羽，哪些線索能幫我們確認最新消息？',
    },
    {
      id: 'level-08-3', speaker: '小羽', scene: 'library', durationMs: 8500,
      text: '讓我們找出可靠的線索，解除公告的混亂！還不確定時，也能先做出穩妥的選擇。',
    },
  ],
  9: [
    {
      id: 'level-09-1', speaker: '旁白', scene: 'sorting', durationMs: 8500,
      text: '新社團開始招募，偏心藤怪只用一條規則分組，把不同興趣的同學綁在同一枝上。',
    },
    {
      id: 'level-09-2', speaker: '米米', scene: 'sorting', durationMs: 8500,
      text: '每個人的興趣都不一樣，它卻沒問大家就分好了。這樣的安排，會不會讓人委屈？',
    },
    {
      id: 'level-09-3', speaker: '小羽', scene: 'sorting', durationMs: 8500,
      text: '我想聽見每位同學的想法！一起解開偏心的藤蔓，讓社團看見每個人的興趣。',
    },
  ],
  10: [
    {
      id: 'level-10-1', speaker: '旁白', scene: 'media', durationMs: 8500,
      text: '班級新建了分享區，偽聲狐狸模仿同學的聲音做影片，讓被冒名的同學很著急。',
    },
    {
      id: 'level-10-2', speaker: '米米', scene: 'media', durationMs: 8500,
      text: '大家忙著猜影片是真是假，被冒名的同學卻很難過。小羽，我們也要照顧他的感受。',
    },
    {
      id: 'level-10-3', speaker: '小羽', scene: 'media', durationMs: 8500,
      text: '讓我們查清影片的來歷，解除假訊息的混亂！也要陪著受影響的伙伴，減少傷害。',
    },
  ],
  11: [
    {
      id: 'level-11-1', speaker: '旁白', scene: 'study', durationMs: 8500,
      text: '新報告任務開始了，捷徑墨魚噴出滿滿答案，卻把思考過程藏在一團墨水裡。',
    },
    {
      id: 'level-11-2', speaker: '米米', scene: 'study', durationMs: 8500,
      text: '報告看起來很漂亮，同學卻說不出自己的想法。小羽，怎麼讓幫手陪我們真正學會？',
    },
    {
      id: 'level-11-3', speaker: '小羽', scene: 'study', durationMs: 8500,
      text: '我想交出能親口說明的成果！一起撥開捷徑的墨水，讓學習看得見自己的努力。',
    },
  ],
  12: [
    {
      id: 'level-12-1', speaker: '旁白', scene: 'team', durationMs: 8500,
      text: '全校準備新的 AI 服務，急速雲巨人只顧快速完成，忽略了資料和設備的不同需要。',
    },
    {
      id: 'level-12-2', speaker: '米米', scene: 'team', durationMs: 8500,
      text: '有人在意資料，有人需要別的參加方式。計畫再快，也不能把這些伙伴留在後面。',
    },
    {
      id: 'level-12-3', speaker: '小羽', scene: 'team', durationMs: 8500,
      text: '讓我們化解只求快的混亂，一起訂下守護約定！讓校園的 AI 幫手照顧更多人的需要。',
    },
  ],
  13: [
    {
      id: 'level-13-1', speaker: '旁白', scene: 'team', durationMs: 8500,
      text: '六種守護魔法匯聚時，混沌魔典王展開巨大的書頁，把校園難題攪成一團。',
    },
    {
      id: 'level-13-2', speaker: '米米', scene: 'team', durationMs: 8500,
      text: '個資、消息和作業問題一起來了！小羽，這次要看清每個情境，選對守護的方法。',
    },
    {
      id: 'level-13-3', speaker: '小羽', scene: 'team', durationMs: 8500,
      text: '我會用六種守護本領看清難題！一起破解魔典的混亂，讓校園裡的幫手恢復可靠。',
    },
  ],
  14: [
    {
      id: 'level-14-1', speaker: '旁白', scene: 'team', durationMs: 8500,
      text: '六種進階魔法準備好了，幻象九頭龍展開晶甲，把真假消息和不同需求藏進幻象。',
    },
    {
      id: 'level-14-2', speaker: '米米', scene: 'team', durationMs: 8500,
      text: '有些畫面很逼真，有些方法很方便，卻可能漏掉伙伴。小羽，我們要一起想周到。',
    },
    {
      id: 'level-14-3', speaker: '小羽', scene: 'team', durationMs: 8500,
      text: '我會查證，也會照顧每個人的需要！一起拆解九頭龍的幻象，完成最終守護挑戰。',
    },
  ],
};

export const getOpeningStory = (): readonly StoryBeat[] => openingStory;

export const getLevelStory = (levelId: number): readonly StoryBeat[] => {
  const story = levelStories[levelId];
  if (!story) throw new Error(`找不到第 ${levelId} 關的劇情。`);
  return story;
};
