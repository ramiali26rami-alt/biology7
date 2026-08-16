const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'public', 'lessons_config.json');
const raw = fs.readFileSync(configPath, 'utf8');
const lessons = JSON.parse(raw);

const lesson2 = {
  id: "u1-l2",
  unit: 1,
  unitNameAr: "الجهاز العصبي",
  unitNameEn: "",
  folder: "U1",
  titleAr: "الجهاز العصبي في الحلقيات (دودة الأرض)",
  titleEn: "Nervous System in Annelids (Earthworm)",
  pdfFile: "u1-l2.pdf",
  diagramFile: "u1-l2.png",
  summaryFile: "",
  mindmapFile: "",
  quizFile: "",
  ministryExamFile: "",
  locked: false,
  pdfLocked: false,
  mindmapLocked: false,
  diagramLocked: false,
  quizLocked: false,
  ministryExamLocked: false,
  videoUrl: "",
  videoChapters: [],
  summaryPointsAr: [
    "تبدي دودة الأرض استجابة واضحة للمؤثرات المحيطة؛ فتنجذب نحو الطعام وتبتعد عن المواد الضارة.",
    "تنسحب دودة الأرض وتدفن نفسها في التراب عند تسليط ضوء شديد عليها بسبب رقي وتعقيد حواسها وجهازها العصبي.",
    "يتكون الجهاز العصبي من: عقدة دماغية مزدوجة فوق بلعومية (الدماغ) تمتد منها حلقة حول بلعومية تلتقي تحت البلعوم بالعقدة العصبية تحت البلعومية.",
    "يمتد بطول الجسم حبل عصبي بطني مزدوج يحمل عقدة عصبية صغيرة في كل حلقة من حلقات الجسم.",
    "تخرج أعصاب من العقدة الدماغية وتحت البلعومية لتغذية الحلقات الأربع الأولى، بينما تستمد باقي الحلقات أعصابها من عقد الحبل العصبي البطني الممتد للخلف.",
    "يخرج من كل عقدة في الحبل العصبي زوج من الأعصاب يتفرع إلى فرعين (أحدهما للناحية البطنية والآخر للجانب) وتتشابك عبر حواجز الحلقات مكونة شبكة من الخيوط العصبية."
  ],
  summaryPointsEn: [],
  flashcards: [
    {
      qAr: "علل: تدفن دودة الأرض نفسها في التراب عند تسليط ضوء شديد عليها؟",
      qEn: "",
      aAr: "لأنها تبدي استجابة سلبية للمؤثرات الضارة والضوء الشديد بفضل الرقي والتعقيد في حواسها وجهازها العصبي لحماية جسمها الرطب.",
      aEn: ""
    },
    {
      qAr: "ما التركيب الذي يمثل الدماغ في دودة الأرض وموقعه بالنسبة للبلعوم؟",
      qEn: "",
      aAr: "عقدة دماغية مزدوجة تقع في الناحية فوق البلعومية.",
      aEn: ""
    },
    {
      qAr: "ما هي الحلقات التي تستمد أعصابها من العقدة الدماغية والعقدة تحت البلعومية؟",
      qEn: "",
      aAr: "الحلقات الأربع الأولى من جسم دودة الأرض.",
      aEn: ""
    },
    {
      qAr: "صف مسار وتفرع الأعصاب الخارجة من كل عقدة عصبية في الحبل العصبي البطني لدودة الأرض.",
      qEn: "",
      aAr: "يخرج من كل عقدة زوج من الأعصاب، يتفرع كل عصب إلى فرعين (أحدهما يتوزع على الناحية البطنية والآخر على الجانب)، وتتشابك الأعصاب عبر حواجز الحلقات مكونة شبكة خيوط عصبية.",
      aEn: ""
    },
    {
      qAr: "ما موقع الحبل العصبي في دودة الأرض وما الذي يميزه في كل حلقة؟",
      qEn: "",
      aAr: "حبل عصبي بطني مزدوج يمتد على طول الجسم نحو الخلف، ويتميز بوجود عقدة عصبية صغيرة في كل حلقة من حلقات الجسم.",
      aEn: ""
    }
  ],
  glossary: [
    {
      termAr: "العقدة فوق البلعومية",
      termEn: "Suprapharyngeal Ganglion",
      defAr: "عقدة دماغية مزدوجة تقع أعلى البلعوم في دودة الأرض وتمثل المركز العصبي الرئيسي (الدماغ)."
    },
    {
      termAr: "الحبل العصبي البطني",
      termEn: "Ventral Nerve Cord",
      defAr: "حبل عصبي مزدوج يمتد على الناحية البطنية لدودة الأرض، يحمل عقدة عصبية في كل حلقة جسمية."
    },
    {
      termAr: "الحلقة حول البلعومية",
      termEn: "Circumpharyngeal Connective",
      defAr: "وصلة عصبية حلقية تحيط بالبلعوم وتربط العقدة الدماغية فوق البلعومية بالعقدة تحت البلعومية."
    }
  ],
  quiz: [
    {
      id: 1,
      type: "tf",
      textAr: "تدفن دودة الأرض نفسها في التراب عند تسليط ضوء شديد عليها.",
      textEn: "",
      options: [
        { key: "A", textAr: "✔️ صح", textEn: "True" },
        { key: "B", textAr: "❌ خطأ", textEn: "False" }
      ],
      correctKey: "A",
      explanationAr: "صح. تبتعد دودة الأرض وتدفن نفسها في التراب كاستجابة وقائية وسلبية للضوء الشديد بفضل تطور جهازها العصبي وحواسها.",
      explanationEn: "",
      hintAr: "تذكر النشاط العملي وتأثير الضوء الشديد على الدودة.",
      hintEn: ""
    },
    {
      id: 2,
      type: "tf",
      textAr: "تقع العقدة الدماغية في دودة الأرض تحت البلعوم مباشرة.",
      textEn: "",
      options: [
        { key: "A", textAr: "✔️ صح", textEn: "True" },
        { key: "B", textAr: "❌ خطأ", textEn: "False" }
      ],
      correctKey: "B",
      explanationAr: "خطأ. العقدة الدماغية هي عقدة مزدوجة فوق بلعومية، بينما العقدة تحت البلعومية تقع أسفل البلعوم وتتصلان بحلقة حول بلعومية.",
      explanationEn: "",
      hintAr: "الدماغ يقع فوق البلعوم وليس تحته.",
      hintEn: ""
    },
    {
      id: 3,
      type: "tf",
      textAr: "يمتد الحبل العصبي في دودة الأرض في الناحية الظهرية لجسمها.",
      textEn: "",
      options: [
        { key: "A", textAr: "✔️ صح", textEn: "True" },
        { key: "B", textAr: "❌ خطأ", textEn: "False" }
      ],
      correctKey: "B",
      explanationAr: "خطأ. الحبل العصبي في دودة الأرض هو حبل عصبي بطني مزدوج يمتد في الناحية البطنية.",
      explanationEn: "",
      hintAr: "اللافقاريات تتميز بوجود حبل عصبي بطني.",
      hintEn: ""
    },
    {
      id: 4,
      type: "tf",
      textAr: "تستمد الحلقات الأربع الأولى في دودة الأرض أعصابها من العقدة الدماغية والعقدة تحت البلعومية.",
      textEn: "",
      options: [
        { key: "A", textAr: "✔️ صح", textEn: "True" },
        { key: "B", textAr: "❌ خطأ", textEn: "False" }
      ],
      correctKey: "A",
      explanationAr: "صح. تخرج الأعصاب من العقدة الدماغية وتحت البلعومية لتغذية الحلقات الأربع الأولى بشكل خاص.",
      explanationEn: "",
      hintAr: "راجع عدد الحلقات الأولى التي تغذيها عقد الرأس والبلعوم.",
      hintEn: ""
    },
    {
      id: 5,
      type: "tf",
      textAr: "يخرج من كل عقدة في الحبل العصبي البطني لدودة الأرض ثلاثة أزواج من الأعصاب.",
      textEn: "",
      options: [
        { key: "A", textAr: "✔️ صح", textEn: "True" },
        { key: "B", textAr: "❌ خطأ", textEn: "False" }
      ],
      correctKey: "B",
      explanationAr: "خطأ. يخرج من كل عقدة في الحبل العصبي زوج واحد من الأعصاب، يتفرع كل منهما إلى فرع بطني وفرع جانبي.",
      explanationEn: "",
      hintAr: "يخرج زوج واحد من الأعصاب من كل عقدة وليس ثلاثة أزواج.",
      hintEn: ""
    },
    {
      id: 6,
      type: "mcq",
      textAr: "يمثل الدماغ في دودة الأرض بواسطة:",
      textEn: "",
      options: [
        { key: "A", textAr: "عقدة عصبية مفردة تحت بلعومية", textEn: "" },
        { key: "B", textAr: "عقدة دماغية مزدوجة فوق بلعومية", textEn: "" },
        { key: "C", textAr: "شبكة عصبية لامركزية", textEn: "" },
        { key: "D", textAr: "عقدة عصبية في الحلقة الأخيرة", textEn: "" }
      ],
      correctKey: "B",
      explanationAr: "الدماغ في دودة الأرض يتكون من عقدة دماغية مزدوجة تقع فوق البلعوم.",
      explanationEn: "",
      hintAr: "عقدة مزدوجة تقع في أعلى البلعوم.",
      hintEn: ""
    },
    {
      id: 7,
      type: "mcq",
      textAr: "الحبل العصبي في دودة الأرض يوصف بأنه:",
      textEn: "",
      options: [
        { key: "A", textAr: "ظهري مفرد أنبوبي", textEn: "" },
        { key: "B", textAr: "بطني مزدوج عليه عقد في كل حلقة", textEn: "" },
        { key: "C", textAr: "جانبي غير معقد", textEn: "" },
        { key: "D", textAr: "شبكة خيوط بدون حبل", textEn: "" }
      ],
      correctKey: "B",
      explanationAr: "الحبل العصبي في دودة الأرض بطني مزدوج يحمل عقدة عصبية في كل حلقة من حلقات الجسم.",
      explanationEn: "",
      hintAr: "مزدوج ويمتد على طول الناحية البطنية.",
      hintEn: ""
    },
    {
      id: 8,
      type: "mcq",
      textAr: "الأعصاب المغذية للحلقات الأربع الأولى في دودة الأرض تنشأ من:",
      textEn: "",
      options: [
        { key: "A", textAr: "العقدة الدماغية والعقدة تحت البلعومية", textEn: "" },
        { key: "B", textAr: "عقد الحبل العصبي الخلفية فقط", textEn: "" },
        { key: "C", textAr: "خلايا حسية في الجلد فقط", textEn: "" },
        { key: "D", textAr: "الحلقة اللاسلكية", textEn: "" }
      ],
      correctKey: "A",
      explanationAr: "تخرج أعصاب الحلقات الأربع الأولى من العقدة الدماغية (فوق البلعومية) والعقدة العصبية تحت البلعومية.",
      explanationEn: "",
      hintAr: "تنشأ من العقدتين المحيطتين بالبلعوم.",
      hintEn: ""
    },
    {
      id: 9,
      type: "mcq",
      textAr: "تتفرع الأعصاب الخارجة من كل عقدة في الحبل العصبي البطني لدودة الأرض إلى فرعين يتوزعان على:",
      textEn: "",
      options: [
        { key: "A", textAr: "الناحية الظهرية فقط", textEn: "" },
        { key: "B", textAr: "الناحية البطنية والجانب", textEn: "" },
        { key: "C", textAr: "الرأس والذيل فقط", textEn: "" },
        { key: "D", textAr: "البلعوم والمريء فقط", textEn: "" }
      ],
      correctKey: "B",
      explanationAr: "يتفرع كل عصب إلى فرعين: أحدهما يتوزع على الناحية البطنية والآخر على الجانب، وتتشابك عبر حواجز الحلقات.",
      explanationEn: "",
      hintAr: "فرع بطني وفرع جانبي.",
      hintEn: ""
    },
    {
      id: 10,
      type: "mcq",
      textAr: "ترجع قدرة دودة الأرض على الانجذاب نحو الطعام والابتعاد عن الضوء الشديد إلى:",
      textEn: "",
      options: [
        { key: "A", textAr: "الرقي والتعقيد في حواسها وجهازها العصبي", textEn: "" },
        { key: "B", textAr: "حساسية البروتوبلازم البدائية فقط", textEn: "" },
        { key: "C", textAr: "غياب الأعصاب والعقد", textEn: "" },
        { key: "D", textAr: "وجود عيون مركبة متطورة", textEn: "" }
      ],
      correctKey: "A",
      explanationAr: "ترجع هذه الاستجابات المنسقة إلى الرقي والتعقيد في الحواس والجهاز العصبي لدودة الأرض مقارنة بالديدان الأقل تطوراً.",
      explanationEn: "",
      hintAr: "التطور العصبي والحسي المنظم.",
      hintEn: ""
    }
  ],
  mindmap: [
    {
      id: "root",
      textAr: "الجهاز العصبي في دودة الأرض",
      textEn: "",
      color: "#10b981",
      details: "جهاز عصبي حبل بطني متطور في الديدان الحلقية يضمن استجابات دقيقة ومنسقة."
    },
    {
      id: "m1",
      parentId: "root",
      textAr: "العقد الدماغية والبلعومية",
      textEn: "",
      color: "#3b82f6",
      details: "عقدة دماغية مزدوجة فوق بلعومية (الدماغ) + حلقة حول بلعومية + عقدة تحت بلعومية."
    },
    {
      id: "m1_1",
      parentId: "m1",
      textAr: "عقدة دماغية فوق بلعومية",
      textEn: "",
      color: "#60a5fa",
      details: "عقدة مزدوجة تمثل الدماغ وتتحكم في استقبال وتنسيق الإشارات العصبية الأمامية."
    },
    {
      id: "m1_2",
      parentId: "m1",
      textAr: "حلقة حول بلعومية",
      textEn: "",
      color: "#60a5fa",
      details: "حلقة عصبية تحيط بالبلعوم وتربط العقدة فوق البلعومية بالعقدة تحت البلعومية."
    },
    {
      id: "m1_3",
      parentId: "m1",
      textAr: "تغذية الحلقات 1 - 4",
      textEn: "",
      color: "#60a5fa",
      details: "تخرج أعصاب من العقدة الدماغية وتحت البلعومية لتغذية الحلقات الأربع الأولى من الجسم."
    },
    {
      id: "m2",
      parentId: "root",
      textAr: "الحبل العصبي البطني المزدوج",
      textEn: "",
      color: "#f59e0b",
      details: "يمتد بطول الناحية البطنية نحو الخلف وعليه عقدة عصبية صغيرة في كل حلقة جسمية."
    },
    {
      id: "m2_1",
      parentId: "m2",
      textAr: "عقدة في كل حلقة",
      textEn: "",
      color: "#fbbf24",
      details: "كل حلقة جسمية تمتلك عقدة عصبية خاصة تمنحها قدرة على الاستجابة والتنسيق الموضعي."
    },
    {
      id: "m2_2",
      parentId: "m2",
      textAr: "تفرع الأعصاب الجانبية والبطنية",
      textEn: "",
      color: "#fbbf24",
      details: "يخرج زوج أعصاب من كل عقدة يتفرع إلى فرع بطني وفرع جانبي تتشابك عبر الحواجز."
    },
    {
      id: "m3",
      parentId: "root",
      textAr: "السلوك والاستجابات البيئية",
      textEn: "",
      color: "#8b5cf6",
      details: "سلوك دقيق مبني على التعقيد الحسي والعصبي للتفاعل مع البيئة."
    },
    {
      id: "m3_1",
      parentId: "m3",
      textAr: "الانجذاب نحو الغذاء",
      textEn: "",
      color: "#a78bfa",
      details: "استجابة إيجابية واضحة نحو مصادر الغذاء في التربة."
    },
    {
      id: "m3_2",
      parentId: "m3",
      textAr: "الابتعاد عن المواد الضارة",
      textEn: "",
      color: "#a78bfa",
      details: "استجابة سلبية دفاعية للابتعاد عن أي منبه كيميائي أو فيزيائي ضار."
    },
    {
      id: "m3_3",
      parentId: "m3",
      textAr: "دفن النفس عند الضوء الشديد",
      textEn: "",
      color: "#a78bfa",
      details: "الهروب من الضوء والحرارة لحماية الجلد الرطب اللازم لعملية التنفس."
    }
  ],
  interactiveDiagrams: [
    {
      imageFile: "u1-l2.png",
      titleAr: "الجهاز العصبي في دودة الأرض",
      titleEn: "Nervous System of Earthworm",
      hotspots: [
        {
          id: "1",
          x: 42.5,
          y: 34.5,
          labelAr: "الدماغ (عقدة فوق بلعومية)",
          labelEn: "Cerebral Ganglion",
          descAr: "عقدة دماغية مزدوجة تقع فوق البلعوم وتمثل مركز التحكم العصبي الرئيسي.",
          descEn: "",
          arrowX: 39.0,
          arrowY: 34.0
        },
        {
          id: "2",
          x: 51.0,
          y: 28.0,
          labelAr: "حلقة حول بلعومية",
          labelEn: "Circumpharyngeal Connective",
          descAr: "حلقة عصبية تحيط بالبلعوم وتصل بين العقدة الدماغية والعقدة تحت البلعومية.",
          descEn: "",
          arrowX: 46.0,
          arrowY: 38.0
        },
        {
          id: "3",
          x: 46.5,
          y: 55.0,
          labelAr: "عقدة عصبية تحت بلعومية",
          labelEn: "Subpharyngeal Ganglion",
          descAr: "عقدة عصبية تلتقي عندها الحلقة حول البلعومية أسفل البلعوم.",
          descEn: "",
          arrowX: 45.0,
          arrowY: 50.0
        },
        {
          id: "4",
          x: 68.0,
          y: 48.0,
          labelAr: "الحبل العصبي البطني المزدوج",
          labelEn: "Ventral Nerve Cord",
          descAr: "حبل عصبي يمتد على طول الناحية البطنية لجسم الدودة نحو الخلف.",
          descEn: "",
          arrowX: 66.0,
          arrowY: 51.0
        },
        {
          id: "5",
          x: 88.0,
          y: 53.0,
          labelAr: "العقد العصبية الحلقية",
          labelEn: "Segmental Ganglia",
          descAr: "عقد عصبية صغيرة متكررة في كل حلقة جسمية يخرج منها زوج من الأعصاب.",
          descEn: "",
          arrowX: 86.0,
          arrowY: 49.0
        }
      ]
    }
  ],
  ministryExams: [
    {
      id: 1,
      type: "tf",
      textAr: "يمتد الحبل العصبي في دودة الأرض على طول الناحية البطنية للجسم.",
      textEn: "",
      options: [
        { key: "T", textAr: "صح", textEn: "True" },
        { key: "F", textAr: "خطأ", textEn: "False" }
      ],
      correctKey: "T",
      explanationAr: "صح. تتميز الحلقيات كدودة الأرض بحبل عصبي بطني مزدوج.",
      hintAr: "اللافقاريات حبلها العصبي بطني بينما الفقاريات ظهري.",
      definition: ""
    },
    {
      id: 2,
      type: "tf",
      textAr: "تتغذى الحلقات الأربع الأولى في دودة الأرض بأعصاب تخرج من العقدة الدماغية والعقدة تحت البلعومية.",
      textEn: "",
      options: [
        { key: "T", textAr: "صح", textEn: "True" },
        { key: "F", textAr: "خطأ", textEn: "False" }
      ],
      correctKey: "T",
      explanationAr: "صح. العقد الدماغية وتحت البلعومية ترسل أعصاباً مباشرة للحلقات الأربع الأولى.",
      hintAr: "نص صريح في الكتاب المدرسي.",
      definition: ""
    },
    {
      id: 3,
      type: "tf",
      textAr: "تدفن دودة الأرض نفسها في التراب عند تعرضها لضوء شديد.",
      textEn: "",
      options: [
        { key: "T", textAr: "صح", textEn: "True" },
        { key: "F", textAr: "خطأ", textEn: "False" }
      ],
      correctKey: "T",
      explanationAr: "صح. استجابة سلبية دفاعية للهروب من الجفاف والمخاطر.",
      hintAr: "استجابة واضحة لتأثير الضوء.",
      definition: ""
    },
    {
      id: 4,
      type: "mcq",
      textAr: "العقدة التي تمثل الدماغ في دودة الأرض هي العقدة:",
      textEn: "",
      options: [
        { key: "A", textAr: "تحت البلعومية", textEn: "" },
        { key: "B", textAr: "المزدوجة فوق البلعومية", textEn: "" },
        { key: "C", textAr: "الحلقية البطنية", textEn: "" },
        { key: "D", textAr: "الشرجية", textEn: "" }
      ],
      correctKey: "B",
      explanationAr: "العقدة الدماغية المزدوجة فوق البلعومية هي التي تمثل دماغ دودة الأرض.",
      hintAr: "فوق البلعوم.",
      definition: ""
    }
  ],
  demoSlides: []
};

// Check if u1-l2 already exists, if so update it, otherwise push
const existingIdx = lessons.findIndex(l => l.id === 'u1-l2');
if (existingIdx >= 0) {
  lessons[existingIdx] = lesson2;
} else {
  lessons.push(lesson2);
}

fs.writeFileSync(configPath, JSON.stringify(lessons, null, 2), 'utf8');
console.log('Successfully updated lessons_config.json with lesson u1-l2! Total lessons:', lessons.length);
