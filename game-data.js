'use strict';

module.exports = {
  CLASSES: {
    'шахтёр':   { bonus: 'mine',  desc: '+20% к добыче' },
    'инженер':  { bonus: 'drill', desc: 'Буры +25%' },
    'нефтяник': { bonus: 'oil',   desc: 'Вышки +30%' },
    'врач':     { bonus: 'heal',  desc: 'Лечить за 50%' },
    'бригадир': { bonus: 'guild', desc: '+10% бригаде' },
  },

  DAILY_BONUS: {
    1:{type:'coins',amount:400},2:{type:'coins',amount:450},3:{type:'coins',amount:500},
    4:{type:'coins',amount:400},5:{type:'coins',amount:450},6:{type:'coins',amount:500},
    0:{type:'drill',amount:1},
  },

  PICKAXE: [
    {level:1,bonus:0,cost:500},{level:2,bonus:30,cost:1500},{level:3,bonus:60,cost:3000},
    {level:4,bonus:90,cost:6000},{level:5,bonus:120,cost:null},
  ],

  SHOP_ITEMS: {
    'еда':{cost:200,desc:'+50 стамины'},'динамит':{cost:500,desc:'x2 добыча'},
    'крыша':{cost:3000,desc:'-50% шанс поимки'},'аптечка':{cost:300,desc:'Лечит вирус'},
    'вакцина':{cost:1000,desc:'Защита 24ч'},'антибиотик':{cost:500,desc:'Ускоряет лечение'},
  },

  ORES: {
    'уголь':{emoji:'🪨',price:50,chance:[0.80,0.80,0.75,0.70,0.65],min:1,max:4},
    'железо':{emoji:'⚙️',price:150,chance:[0.35,0.40,0.50,0.55,0.60],min:1,max:3},
    'алмаз':{emoji:'💎',price:500,chance:[0.05,0.10,0.18,0.28,0.40],min:1,max:2},
    'золото':{emoji:'🥇',price:800,chance:[0.03,0.07,0.13,0.22,0.35],min:1,max:2},
    'рубин':{emoji:'🔴',price:1200,chance:[0.01,0.03,0.07,0.14,0.25],min:1,max:1},
    'платина':{emoji:'🪙',price:2000,chance:[0.00,0.01,0.03,0.07,0.15],min:1,max:1},
  },

  CRAFT_RESOURCES: {
    'железная_пластина':{emoji:'🔩',name:'Пластина',chance:0.15,min_lvl:1},
    'шестерня':{emoji:'⚙️',name:'Шестерня',chance:0.10,min_lvl:2},
    'алмазный_наконечник':{emoji:'💎',name:'Наконечник',chance:0.05,min_lvl:3},
    'магнит':{emoji:'🧲',name:'Магнит',chance:0.02,min_lvl:4},
    'смазка':{emoji:'🧪',name:'Смазка',chance:0.20,min_lvl:1},
  },

  CRAFT_RECIPES: {
    'пластина':{name:'Пластина',emoji:'🔩',result_type:'craft_resource',result_item:'железная_пластина',result_amount:1,ingredients:{'железо':3,'уголь':2},coins_cost:100},
    'бур_обычный':{name:'Бур',emoji:'⚙️',result_type:'drill',result_amount:1,ingredients:{'железо':10,'уголь':5},coins_cost:500},
    'бур_усиленный':{name:'Усил. бур',emoji:'🔩',result_type:'drill_enhanced',result_amount:1,ingredients:{'железная_пластина':5,'шестерня':3,'смазка':1},coins_cost:1000},
    'бур_алмазный':{name:'Алм. бур',emoji:'💎',result_type:'drill_diamond',result_amount:1,ingredients:{'алмазный_наконечник':2,'магнит':1},coins_cost:3000},
    'вышка_нефтяная':{name:'Вышка',emoji:'🛢️',result_type:'oil_rig',result_amount:1,ingredients:{'железо':20,'шестерня':10,'смазка':5},coins_cost:2500},
    'шестерня_крафт':{name:'Шестерня',emoji:'⚙️',result_type:'craft_resource',result_item:'шестерня',result_amount:1,ingredients:{'железо':5},coins_cost:200},
    'алмазный_наконечник_крафт':{name:'Наконечник',emoji:'💎',result_type:'craft_resource',result_item:'алмазный_наконечник',result_amount:1,ingredients:{'алмаз':3,'железная_пластина':2},coins_cost:500},
    'магнит_крафт':{name:'Магнит',emoji:'🧲',result_type:'craft_resource',result_item:'магнит',result_amount:1,ingredients:{'золото':5,'рубин':2},coins_cost:1000},
  },
};
