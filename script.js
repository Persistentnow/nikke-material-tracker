// ==================== 常量定义 ====================
const THEMES = {
  DARK: 'dark',
  LIGHT: 'light',
  NIKKE: 'nikke'
};

// 筛选状态
let filterState = {
  startDate: '',
  endDate: '',
  stage: '',
  search: ''
};

const STORAGE_KEYS = {
  THEME: 'nikke-theme',
  RECORDS: 'nikkeRecords',
  EXPECTATIONS: 'nikkeExpect',
  SETTINGS: 'nikkeSettings'
};

const STAGE_EXPECTATIONS = {
  '5': { normal: 1.66, double: 3.32 },
  '6': { normal: 2.15, double: 4.31 },
  '7': { normal: 2.28, double: 4.56 }
};

const STAGE_PARTS = {
  '5': 81,
  '6': 105,
  '7': 111
};

// ==================== 全局状态 ====================
let currentTheme = THEMES.DARK;
let materialRecords = [];
let expectations = { daily: 0, monthly: 0 };
let currentStatsView = 'daily';
let currentSortBy = 'date';
let isEditing = false;
let editingId = null;

// ==================== 工具函数 ====================
function getStageExpectation(stage, isDouble) {
  const expectations = STAGE_EXPECTATIONS[stage];
  return expectations ? (isDouble ? expectations.double : expectations.normal) : 0;
}

// 获取记录的总期望产出（兼容新旧数据格式）
function getRecordExpectation(record) {
  if (record.stageExpectation !== undefined && record.stageExpectation !== null) {
    // 检查是新数据格式还是旧数据格式
    if (record.stage1 !== undefined) {
      // 新数据格式，stageExpectation已经是三次之和
      return record.stageExpectation;
    } else {
      // 旧数据格式，stageExpectation是单次的，需要乘以3
      return record.stageExpectation * 3;
    }
  }
  
  // 没有保存的期望，根据阶段信息计算
  if (record.stage1 !== undefined) {
    // 新数据格式
    return getStageExpectation(record.stage1, record.isDouble) +
           getStageExpectation(record.stage2, record.isDouble) +
           getStageExpectation(record.stage3, record.isDouble);
  } else if (record.stage && STAGE_EXPECTATIONS[record.stage]) {
    // 旧数据格式，乘以3
    return getStageExpectation(record.stage, record.isDouble) * 3;
  }
  
  return expectations.daily || 2.15;
}

function sanitizeHTML(str) {
  const temp = document.createElement('div');
  temp.textContent = str;
  return temp.innerHTML;
}

function validateRecord(data) {
  const errors = [];
  
  if (!data.date) {
    errors.push('日期不能为空');
  }
  
  if (data.m1 < 0 || data.m2 < 0 || data.m3 < 0 || data.parts < 0) {
    errors.push('数量不能为负数');
  }
  
  if (!data.stage1 || !data.stage2 || !data.stage3) {
    errors.push('请选择所有阶段');
  }
  
  return { isValid: errors.length === 0, errors };
}

// ==================== 错误处理 ====================
window.onerror = (msg, url, lineNo, columnNo, error) => {
  console.error('Global error:', error);
  showNotification('发生了一个错误，请刷新页面重试', 'error');
  return false;
};

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  showNotification('发生了一个错误，请刷新页面重试', 'error');
});

// ==================== DOM 元素 ====================
const materialForm = document.getElementById('material-form');
const historyTable = document.getElementById('history-table');
const noRecords = document.getElementById('no-records');
const doublePartsCheck = document.getElementById('double-parts-check');

const actualTotalEl = document.getElementById('actual-total');
const expectedTotalEl = document.getElementById('expected-total');
const differenceTotalEl = document.getElementById('difference-total');
const productionTotalEl = document.getElementById('production-total');
const realtimeProductionEl = document.getElementById('realtime-production');
const realtimeDifferenceEl = document.getElementById('realtime-difference');

// ==================== 主题管理 ====================
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded, initializing theme system');
  
  const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
  if (savedTheme) {
    currentTheme = savedTheme;
    console.log('Loaded saved theme:', currentTheme);
  }
  
  applyTheme(currentTheme);
  
  // 绑定三个主题按钮
  const themeOptionBtns = document.querySelectorAll('.theme-option-btn');
  themeOptionBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const newTheme = this.getAttribute('data-theme');
      console.log('Theme changed to:', newTheme);
      currentTheme = newTheme;
      applyTheme(currentTheme);
      localStorage.setItem(STORAGE_KEYS.THEME, currentTheme);
    });
  });
  
  function applyTheme(theme) {
    console.log('Applying theme:', theme);
    document.documentElement.setAttribute('data-theme', theme);
    
    // 更新按钮状态
    const themeOptionBtns = document.querySelectorAll('.theme-option-btn');
    themeOptionBtns.forEach(btn => {
      const btnTheme = btn.getAttribute('data-theme');
      if (btnTheme === theme) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }
});

// ==================== 阶段选择 ====================
function setupAcquisitionStageEvents() {
  for (let i = 1; i <= 3; i++) {
    const stageSelect = document.getElementById(`stage-${i}`);
    const partsInput = document.getElementById(`parts-${i}`);
    
    if (stageSelect && partsInput) {
      stageSelect.addEventListener('change', function () {
        if (STAGE_PARTS[this.value]) {
          partsInput.value = STAGE_PARTS[this.value];
        }
        updateRealTimeCalculation();
      });
    }
  }
}

doublePartsCheck.addEventListener('change', function () {
  const stage1 = document.getElementById('stage-1')?.value || '7';
  const expectationInput = document.getElementById('expectation-value');
  const expectationType = document.getElementById('expectation-type').value;
  
  if (STAGE_EXPECTATIONS[stage1]) {
    const dailyValue = getStageExpectation(stage1, this.checked);
    expectationInput.value = expectationType === 'monthly' ? (dailyValue * 30).toFixed(2) : dailyValue;
  }
  updateRealTimeCalculation();
});

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', () => {
  console.log('=== 开始初始化NIKKE材料记录工具 ===');
  
  document.getElementById('record-date').valueAsDate = new Date();
  
  console.log('1. 加载本地数据...');
  loadData();
  
  console.log('2. 设置实时保存功能...');
  setupRealTimeSettingsSave();
  
  console.log('3. 更新界面显示...');
  renderTable();
  updateStats();
  renderCharts();
  
  console.log('4. 绑定事件处理...');
  bindEvents();
  setupAcquisitionStageEvents();
  setupRealTimeCalculation();
  setupDateNavigation();
  setupImportExport();
  
  const expectationType = document.getElementById('expectation-type');
  const advancedMonthly = document.querySelector('.advanced-monthly');
  if (expectationType.value === 'monthly') {
    advancedMonthly.style.display = 'block';
  } else {
    advancedMonthly.style.display = 'none';
  }
  
  console.log('5. 初始化图表...');
  initCharts();
  renderCharts();
  
  console.log('6. 初始化默认期望产出...');
  const defaultStage = '7';
  const isDouble = doublePartsCheck.checked;
  const expectationInput = document.getElementById('expectation-value');
  const expectType = document.getElementById('expectation-type').value;
  const dailyValue = getStageExpectation(defaultStage, isDouble);
  expectationInput.value = expectType === 'monthly' ? (dailyValue * 30).toFixed(2) : dailyValue;
  
  console.log('=== 初始化完成 ===');
});

// 绑定事件
function bindEvents(){
    console.log('绑定事件开始');
    
    // 保存期望
    const saveBtn = document.getElementById('save-expectation');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const type = document.getElementById('expectation-type').value;
            const val = +document.getElementById('expectation-value').value || 0;
            
            console.log('开始保存期望设置 - 类型:', type, '值:', val);
            
            expectations[type] = val;
            save();
            updateStats();
  renderCharts();
            renderCharts();
            
            console.log('期望设置保存成功:', expectations);
            
            // 显示保存成功提示
            const originalText = saveBtn.textContent;
            const originalBg = saveBtn.style.background;
            const originalColor = saveBtn.style.color;
            
            saveBtn.textContent = '保存成功!';
            saveBtn.style.background = 'linear-gradient(45deg, #4caf50, #45a049)';
            saveBtn.style.color = '#fff';
            
            setTimeout(() => {
                saveBtn.textContent = originalText;
                saveBtn.style.background = originalBg;
                saveBtn.style.color = originalColor;
            }, 2000);
        });
    }

    // 日/月切换
    const dailyBtn = document.getElementById('daily-stats');
    const monthlyBtn = document.getElementById('monthly-stats');
    
    if (dailyBtn) {
        dailyBtn.onclick = () => {
            console.log('切换到按天统计');
            currentStatsView = 'daily';
            dailyBtn.classList.add('active');
            monthlyBtn.classList.remove('active');
            document.getElementById('expectation-value').value = expectations.daily;
            document.getElementById('expectation-type').value = 'daily';
            document.querySelector('.advanced-monthly').style.display = 'none';
            updateStats();
  renderCharts();
            renderCharts();
        };
    }
    
    if (monthlyBtn) {
        monthlyBtn.onclick = () => {
            console.log('切换到按月统计');
            currentStatsView = 'monthly';
            monthlyBtn.classList.add('active');
            dailyBtn.classList.remove('active');
            document.getElementById('expectation-value').value = expectations.monthly;
            document.getElementById('expectation-type').value = 'monthly';
            // 显示高级设置面板
            document.querySelector('.advanced-monthly').style.display = 'block';
            updateStats();
  renderCharts();
            renderCharts();
        };
    }
    
    // 期望类型切换时转换数值和显示/隐藏高级设置
    document.getElementById('expectation-type').addEventListener('change', function() {
        const currentValue = +document.getElementById('expectation-value').value || 0;
        const expectationInput = document.getElementById('expectation-value');
        const advancedMonthly = document.querySelector('.advanced-monthly');
        
        if (this.value === 'monthly') {
            // 日值转月值
            expectationInput.value = (currentValue * 30).toFixed(2);
            // 显示高级设置
            advancedMonthly.style.display = 'block';
        } else {
            // 月值转日值
            expectationInput.value = (currentValue / 30).toFixed(2);
            // 隐藏高级设置
            advancedMonthly.style.display = 'none';
        }
    });
    
    // 智能计算月期望
    const calculateBtn = document.getElementById('calculate-monthly');
    if (calculateBtn) {
      calculateBtn.addEventListener('click', function() {
        console.log('开始智能计算月期望');
        
        const doubleDays = +document.getElementById('double-days').value || 0;
        const normalDays = +document.getElementById('normal-days').value || 0;
        const stage = document.getElementById('stage-type').value;
        const expectationInput = document.getElementById('expectation-value');
        
        console.log('计算参数:', { doubleDays, normalDays, stage });
        
        // 根据阶段获取日期望
        let normalDaily, doubleDaily;
        if (STAGE_EXPECTATIONS[stage]) {
          normalDaily = STAGE_EXPECTATIONS[stage].normal;
          doubleDaily = STAGE_EXPECTATIONS[stage].double;
          console.log('使用阶段预设值:', { normalDaily, doubleDaily });
        } else {
          normalDaily = expectations.daily || 2.15;
          doubleDaily = normalDaily * 2;
          console.log('使用默认设置，日期望值:', { normalDaily, doubleDaily });
        }
        
        // 计算月期望
        const normalExpectation = normalDaily * normalDays;
        const doubleExpectation = doubleDaily * doubleDays;
        const monthlyExpectation = normalExpectation + doubleExpectation;
        
        console.log('=== 智能计算月期望详细信息 ===');
        console.log(`- 选择阶段: ${stage}阶段`);
        console.log(`- 日期望值: 普通=${normalDaily}, 双倍=${doubleDaily}`);
        console.log(`- 天数设置: 普通=${normalDays}天, 双倍=${doubleDays}天`);
        console.log(`- 计算过程:`);
        console.log(`  - 普通天数期望值: ${normalDaily} × ${normalDays} = ${normalExpectation.toFixed(2)}`);
        console.log(`  - 双倍天数期望值: ${doubleDaily} × ${doubleDays} = ${doubleExpectation.toFixed(2)}`);
        console.log(`  - 月度总期望: ${normalExpectation.toFixed(2)} + ${doubleExpectation.toFixed(2)} = ${monthlyExpectation.toFixed(2)}`);
        
        expectationInput.value = monthlyExpectation.toFixed(2);
        
        // 自动保存计算结果
        expectations.monthly = monthlyExpectation;
        save();
        updateStats();
  renderCharts();
        
        console.log('智能计算结果已自动保存:', {
          monthly: monthlyExpectation,
          daily: monthlyExpectation / 30
        });
        
        // 显示计算结果提示
        this.textContent = '计算完成并已保存!';
        this.style.background = 'linear-gradient(45deg, #4caf50, #45a049)';
        this.style.color = '#fff';
        setTimeout(() => {
          this.textContent = '智能计算月期望';
          this.style.background = 'linear-gradient(45deg, var(--accent), #ff9800)';
          this.style.color = '#000';
        }, 2000);
      });
    }

    // 排序
    document.getElementById('sort-date').onclick = () => {
        currentSortBy = 'date';
        document.getElementById('sort-date').classList.add('active');
        document.getElementById('sort-difference').classList.remove('active');
        renderTable();
    };
    document.getElementById('sort-difference').onclick = () => {
        currentSortBy = 'diff';
        document.getElementById('sort-difference').classList.add('active');
        document.getElementById('sort-date').classList.remove('active');
        renderTable();
    };
}

// 实时计算功能
function setupRealTimeCalculation() {
    const inputs = ['modules-1', 'modules-2', 'modules-3', 'parts-1', 'parts-2', 'parts-3', 'stage-1', 'stage-2', 'stage-3'];
    
    inputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', updateRealTimeCalculation);
            element.addEventListener('change', updateRealTimeCalculation);
        }
    });
    
    doublePartsCheck.addEventListener('change', updateRealTimeCalculation);
}

function updateRealTimeCalculation() {
    // 重新获取实时预览元素，确保它们存在
    const realtimeProductionEl = document.getElementById('realtime-production');
    const realtimeDifferenceEl = document.getElementById('realtime-difference');
    
    if (!realtimeProductionEl || !realtimeDifferenceEl) {
        console.error('实时预览元素未找到');
        return;
    }
    
    const m1 = +document.getElementById('modules-1').value || 0;
    const m2 = +document.getElementById('modules-2').value || 0;
    const m3 = +document.getElementById('modules-3').value || 0;
    
    let totalParts = 0;
    let totalStageExpectation = 0;
    const isDouble = doublePartsCheck.checked;
    
    for (let i = 1; i <= 3; i++) {
        const parts = +document.getElementById(`parts-${i}`)?.value || 0;
        const stage = document.getElementById(`stage-${i}`)?.value || '7';
        totalParts += isDouble ? parts * 2 : parts;
        totalStageExpectation += getStageExpectation(stage, isDouble);
    }
    
    const totalModules = m1 + m2 + m3;
    const partsToMod = (totalParts / 100).toFixed(2);
    const totalProduction = (totalModules + parseFloat(partsToMod)).toFixed(2);
    
    // 差值计算基于模组数量，使用三次获取的期望之和
    const difference = (totalModules - totalStageExpectation).toFixed(2);
    
    // 更新显示
    realtimeProductionEl.textContent = totalProduction;
    realtimeDifferenceEl.textContent = difference;
    realtimeDifferenceEl.className = `realtime-value ${parseFloat(difference) >= 0 ? 'difference-positive' : 'difference-negative'}`;
    
    console.log(`实时预览 - 模组=${totalModules}, 零件=${totalParts}, 零件换算=${partsToMod}, 总产出=${totalProduction}, 期望=${totalStageExpectation}, 差值=${difference}`);
}

// 日期导航功能 - 安全处理时区问题
function setupDateNavigation() {
    const dateInput = document.getElementById('record-date');
    const prevBtn = document.getElementById('prev-day');
    const nextBtn = document.getElementById('next-day');
    
    prevBtn.addEventListener('click', () => {
        // 从输入字符串直接提取年月日，避免时区问题
        const parts = extractDateParts(dateInput.value);
        if (parts) {
            // 使用 UTC 日期计算，避免跨天偏移
            const currentDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0));
            currentDate.setUTCDate(currentDate.getUTCDate() - 1);
            // 设置为本地时间的对应日期
            const localDate = new Date(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate());
            dateInput.valueAsDate = localDate;
        }
    });
    
    nextBtn.addEventListener('click', () => {
        // 从输入字符串直接提取年月日，避免时区问题
        const parts = extractDateParts(dateInput.value);
        if (parts) {
            // 使用 UTC 日期计算，避免跨天偏移
            const currentDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0));
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
            
            // 不能选择未来日期（基于本地时间）
            const today = new Date();
            const todayParts = {
                year: today.getFullYear(),
                month: today.getMonth() + 1,
                day: today.getDate()
            };
            
            const newYear = currentDate.getUTCFullYear();
            const newMonth = currentDate.getUTCMonth() + 1;
            const newDay = currentDate.getUTCDate();
            
            // 比较年月日，避免时分秒影响
            const isFuture = (newYear > todayParts.year) || 
                             (newYear === todayParts.year && newMonth > todayParts.month) ||
                             (newYear === todayParts.year && newMonth === todayParts.month && newDay > todayParts.day);
            
            if (!isFuture) {
                const localDate = new Date(newYear, newMonth - 1, newDay);
                dateInput.valueAsDate = localDate;
            }
        }
    });
}

// ==================== 导入导出 ====================
function setupImportExport() {
  const exportBtn = document.getElementById('export-data');
  const exportCsvBtn = document.getElementById('export-csv-data');
  const importBtn = document.getElementById('import-data');
  const fileInput = document.getElementById('file-input');

  // JSON 导出
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const data = {
        records: materialRecords,
        expectations: expectations,
        exportDate: new Date().toISOString(),
        version: '2.0.0'
      };
      
      const dataStr = JSON.stringify(data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `nikke-material-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      showNotification('数据导出成功！', 'success');
    });
  }

  // CSV 导出
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      exportToCSV(materialRecords);
    });
  }

  // 导入数据
  if (importBtn) {
    importBtn.addEventListener('click', () => {
      fileInput.click();
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          
          if (!data.records || !Array.isArray(data.records)) {
            throw new Error('无效的数据格式');
          }
          
          materialRecords = data.records;
          if (data.expectations) {
            expectations = data.expectations;
          }
          
          save();
          renderTable();
          updateStats();
  renderCharts();
          
          document.getElementById('expectation-value').value = currentStatsView === 'daily' ? 
            expectations.daily : expectations.monthly;
          
          showNotification('数据导入成功！', 'success');
        } catch (error) {
          console.error('导入失败:', error);
          showNotification('数据导入失败，请检查文件格式！', 'error');
        }
      };
      
      reader.readAsText(file);
      e.target.value = '';
    });
  }
}

function exportToCSV(records) {
  const headers = ['日期', '阶段1', '阶段2', '阶段3', '第一次', '第二次', '第三次', '零件1', '零件2', '零件3', '总零件', '模组总数', '零件换算', '总产出', '期望', '差值'];
  const csvContent = [
    headers.join(','),
    ...records.map(r => {
      const s1 = r.stage1 || r.stage || '-';
      const s2 = r.stage2 || r.stage || '-';
      const s3 = r.stage3 || r.stage || '-';
      const p1 = r.parts1 || Math.round(r.parts / 3) || 0;
      const p2 = r.parts2 || Math.round(r.parts / 3) || 0;
      const p3 = r.parts3 || Math.round(r.parts / 3) || 0;
      return [
        r.date,
        s1, s2, s3,
        r.m1, r.m2, r.m3,
        p1, p2, p3,
        r.parts,
        r.totalModules,
        r.partsToMod,
        r.totalProduction,
        r.stageExpectation || '-',
        r.diff
      ].join(',');
    })
  ].join('\n');
  
  const dataBlob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(dataBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `nikke-material-data-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  showNotification('CSV 数据导出成功！', 'success');
}

// 显示通知（支持HTML内容，例如撤销按钮）
function showNotification(message, type = 'info', duration = 3000) {
    // 移除现有的通知
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    // 关键修复：使用 innerHTML 而不是 textContent，
    // 这样才能正确渲染 HTML 标签（如 <button class="undo-btn">撤销</button>）
    notification.innerHTML = message;
    
    // 添加样式
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '12px 24px',
        borderRadius: '8px',
        color: '#fff',
        fontWeight: 'bold',
        zIndex: '1000',
        transform: 'translateX(100%)',
        transition: 'transform 0.3s ease',
        backgroundColor: type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#2196f3',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        maxWidth: '90vw',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
    });
    
    document.body.appendChild(notification);
    
    // 显示动画
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // 自动隐藏（支持自定义时长）
    setTimeout(() => {
        // 如果通知已被用户点击移除，则不执行动画
        if (!document.body.contains(notification)) return;
        
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, duration);
}

// ==================== 数据管理 ====================
function loadData() {
  materialRecords = JSON.parse(localStorage.getItem(STORAGE_KEYS.RECORDS)) || [];
  expectations = JSON.parse(localStorage.getItem(STORAGE_KEYS.EXPECTATIONS)) || { daily: 0, monthly: 0 };
  document.getElementById('expectation-value').value = expectations.daily;
  
  const savedSettings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS)) || {};
  const doubleDays = document.getElementById('double-days');
  const normalDays = document.getElementById('normal-days');
  const stageType = document.getElementById('stage-type');
  
  if (doubleDays && savedSettings.doubleDays !== undefined) {
    doubleDays.value = savedSettings.doubleDays;
  }
  
  if (normalDays && savedSettings.normalDays !== undefined) {
    normalDays.value = savedSettings.normalDays;
  }
  
  if (stageType && savedSettings.stageType !== undefined) {
    stageType.value = savedSettings.stageType;
  }
  
  console.log('加载设置:', savedSettings);
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(materialRecords));
    localStorage.setItem(STORAGE_KEYS.EXPECTATIONS, JSON.stringify(expectations));
    console.log('保存记录和期望设置成功');
    
    const doubleDays = document.getElementById('double-days');
    const normalDays = document.getElementById('normal-days');
    const stageType = document.getElementById('stage-type');
    
    if (doubleDays && normalDays && stageType) {
      const settings = {
        doubleDays: doubleDays.value,
        normalDays: normalDays.value,
        stageType: stageType.value
      };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
      console.log('保存高级设置成功:', settings);
    }
  } catch (error) {
    console.error('保存数据失败:', error);
    showNotification('保存数据失败，请重试', 'error');
  }
}

// 实时保存设置
function setupRealTimeSettingsSave() {
    const settingElements = ['double-days', 'normal-days', 'stage-type'];
    
    settingElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', function() {
                console.log(`设置 ${id} 变更为: ${this.value}`);
                saveSettings();
            });
            
            element.addEventListener('input', function() {
                // 对于数字输入，也在输入时保存
                if (this.type === 'number') {
                    console.log(`设置 ${id} 输入为: ${this.value}`);
                }
            });
        } else {
            console.warn('无法找到设置元素:', id);
        }
    });
}

// 单独保存设置
function saveSettings() {
    try {
        const doubleDays = document.getElementById('double-days');
        const normalDays = document.getElementById('normal-days');
        const stageType = document.getElementById('stage-type');
        
        if (doubleDays && normalDays && stageType) {
            const settings = {
                doubleDays: doubleDays.value,
                normalDays: normalDays.value,
                stageType: stageType.value
            };
            localStorage.setItem('nikkeSettings', JSON.stringify(settings));
            console.log('实时保存设置成功:', settings);
            
            // 显示保存提示
            showNotification('设置已自动保存', 'success');
        }
    } catch (error) {
        console.error('实时保存设置失败:', error);
    }
}

// ==================== 记录提交与更新 ====================
materialForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const date = document.getElementById('record-date').value;
  const m1 = +document.getElementById('modules-1').value || 0;
  const m2 = +document.getElementById('modules-2').value || 0;
  const m3 = +document.getElementById('modules-3').value || 0;
  
  const stage1 = document.getElementById('stage-1').value;
  const stage2 = document.getElementById('stage-2').value;
  const stage3 = document.getElementById('stage-3').value;
  const parts1 = +document.getElementById('parts-1').value || 0;
  const parts2 = +document.getElementById('parts-2').value || 0;
  const parts3 = +document.getElementById('parts-3').value || 0;

  const isDouble = doublePartsCheck.checked;
  const finalParts1 = isDouble ? parts1 * 2 : parts1;
  const finalParts2 = isDouble ? parts2 * 2 : parts2;
  const finalParts3 = isDouble ? parts3 * 2 : parts3;
  const totalParts = finalParts1 + finalParts2 + finalParts3;

  // 确定主阶段（如果三个阶段相同则用该阶段，否则标记为mixed）
  let mainStage = stage1;
  if (stage1 !== stage2 || stage1 !== stage3) {
    mainStage = 'mixed';
  }

  const totalModules = m1 + m2 + m3;
  const partsToMod = (totalParts / 100).toFixed(2);
  const totalProduction = (totalModules + parseFloat(partsToMod)).toFixed(2);
  
  // 计算三次获取的期望产出之和
  let stageExpectation = getStageExpectation(stage1, isDouble) + 
                          getStageExpectation(stage2, isDouble) + 
                          getStageExpectation(stage3, isDouble);
  const diff = (totalModules - stageExpectation).toFixed(2);
  
  console.log(`记录处理 - 日期:${date}, 阶段:${stage1}/${stage2}/${stage3}, 模组:${totalModules}, 零件:${totalParts}, 差值:${diff}`);

  // 输入验证
  const validationResult = validateRecord({ 
    date, m1, m2, m3, 
    parts: totalParts, 
    stage1, stage2, stage3 
  });
  if (!validationResult.isValid) {
    showNotification(validationResult.errors.join('; '), 'error');
    return;
  }

  if (isEditing && editingId) {
    // 更新现有记录
    const index = materialRecords.findIndex(r => r.id === editingId);
    if (index !== -1) {
      materialRecords[index] = {
        ...materialRecords[index],
        date, m1, m2, m3, 
        stage1, stage2, stage3,
        parts1: finalParts1, parts2: finalParts2, parts3: finalParts3,
        parts: totalParts, stage: mainStage, isDouble,
        totalModules, partsToMod, totalProduction, diff, stageExpectation
      };
      showNotification('记录更新成功！', 'success');
    }
    resetForm();
  } else {
    // 新增记录
    if (materialRecords.some(i => i.date === date)) {
      showNotification('该日期已存在记录', 'error');
      return;
    }

    materialRecords.push({
      id: Date.now(), date, m1, m2, m3, 
      stage1, stage2, stage3,
      parts1: finalParts1, parts2: finalParts2, parts3: finalParts3,
      parts: totalParts, stage: mainStage, isDouble,
      totalModules, partsToMod, totalProduction, diff, stageExpectation
    });
    
    showNotification('记录添加成功！', 'success');
    resetForm();
  }

  save();
  renderTable();
  updateStats();
  renderCharts();
});

// ==================== 记录编辑与渲染 ====================
function editRecord(id) {
  const record = materialRecords.find(r => r.id === id);
  if (!record) return;
  
  console.log('开始编辑记录:', record);
  isEditing = true;
  editingId = id;
  
  document.getElementById('record-date').value = record.date;
  document.getElementById('modules-1').value = record.m1;
  document.getElementById('modules-2').value = record.m2;
  document.getElementById('modules-3').value = record.m3;
  
  // 兼容旧数据格式
  if (record.stage1 !== undefined) {
    document.getElementById('stage-1').value = record.stage1;
    document.getElementById('stage-2').value = record.stage2;
    document.getElementById('stage-3').value = record.stage3;
    document.getElementById('parts-1').value = record.parts1 / (record.isDouble ? 2 : 1);
    document.getElementById('parts-2').value = record.parts2 / (record.isDouble ? 2 : 1);
    document.getElementById('parts-3').value = record.parts3 / (record.isDouble ? 2 : 1);
  } else {
    // 旧数据格式，填充相同的阶段和零件
    document.getElementById('stage-1').value = record.stage || '7';
    document.getElementById('stage-2').value = record.stage || '7';
    document.getElementById('stage-3').value = record.stage || '7';
    const avgParts = Math.round((record.parts / (record.isDouble ? 2 : 1)) / 3);
    document.getElementById('parts-1').value = avgParts;
    document.getElementById('parts-2').value = avgParts;
    document.getElementById('parts-3').value = avgParts;
  }
  
  document.getElementById('double-parts-check').checked = record.isDouble;
  
  const submitBtn = document.querySelector('.submit-btn');
  submitBtn.textContent = '更新记录';
  
  document.getElementById('record-date').focus();
  showNotification('已加载记录到表单，修改后点击更新', 'info');
  updateRealTimeCalculation();
}

function resetForm() {
  isEditing = false;
  editingId = null;
  
  materialForm.reset();
  doublePartsCheck.checked = false;
  document.getElementById('record-date').valueAsDate = new Date();
  
  // 重置为默认7阶段和111零件
  for (let i = 1; i <= 3; i++) {
    document.getElementById(`stage-${i}`).value = '7';
    document.getElementById(`parts-${i}`).value = STAGE_PARTS['7'];
  }
  
  const submitBtn = document.querySelector('.submit-btn');
  submitBtn.textContent = '提交记录';
  updateRealTimeCalculation();
}

// 渲染表格
function renderTable() {
  historyTable.innerHTML = '';
  if (materialRecords.length === 0) {
    noRecords.style.display = 'block';
    return;
  }
  noRecords.style.display = 'none';

  let list = [...materialRecords].sort((a, b) => new Date(b.date) - new Date(a.date));
  if (currentSortBy === 'diff') list.sort((a, b) => b.diff - a.diff);

  const thead = historyTable.parentElement.querySelector('thead tr');
  if (thead) {
    thead.innerHTML = `
      <th>日期</th>
      <th>阶段</th>
      <th class="mobile-hide">第一次</th>
      <th class="mobile-hide">第二次</th>
      <th class="mobile-hide">第三次</th>
      <th>零件</th>
      <th class="mobile-hide">期望产出</th>
      <th>模组总数</th>
      <th class="mobile-hide">零件换算</th>
      <th class="mobile-hide">总产出</th>
      <th>差值</th>
      <th>操作</th>
    `;
  }

  list.forEach(item => {
    const recalculatedPartsToMod = (item.parts / 100).toFixed(2);
    const recalculatedProduction = (item.totalModules + parseFloat(recalculatedPartsToMod)).toFixed(2);
    
    const expectedValue = getRecordExpectation(item);
    const recalculatedDiff = (item.totalModules - expectedValue).toFixed(2);
    
    // 构建阶段显示文本
    let stageDisplay = '';
    if (item.stage1 !== undefined) {
      stageDisplay = `${item.stage1}/${item.stage2}/${item.stage3}`;
    } else {
      stageDisplay = item.stage || '-';
    }
    
    const tr = document.createElement('tr');
    
    // 安全创建单元格，防止 XSS
    const tdDate = document.createElement('td');
    tdDate.textContent = item.date;
    
    const tdStage = document.createElement('td');
    tdStage.textContent = stageDisplay;
    
    const tdM1 = document.createElement('td');
    tdM1.className = 'mobile-hide';
    tdM1.textContent = item.m1;
    
    const tdM2 = document.createElement('td');
    tdM2.className = 'mobile-hide';
    tdM2.textContent = item.m2;
    
    const tdM3 = document.createElement('td');
    tdM3.className = 'mobile-hide';
    tdM3.textContent = item.m3;
    
    const tdParts = document.createElement('td');
    tdParts.textContent = item.parts;
    if (item.isDouble) {
      const badge = document.createElement('span');
      badge.className = 'double-badge';
      badge.textContent = 'X2';
      tdParts.appendChild(document.createTextNode(' '));
      tdParts.appendChild(badge);
    }
    
    const tdStageExpectation = document.createElement('td');
    tdStageExpectation.className = 'mobile-hide';
    tdStageExpectation.textContent = item.stageExpectation || '-';
    
    const tdTotalModules = document.createElement('td');
    tdTotalModules.textContent = item.totalModules;
    
    const tdPartsToMod = document.createElement('td');
    tdPartsToMod.className = 'mobile-hide';
    tdPartsToMod.textContent = recalculatedPartsToMod;
    
    const tdProduction = document.createElement('td');
    tdProduction.className = 'production-value mobile-hide';
    tdProduction.textContent = recalculatedProduction;
    
    const tdDiff = document.createElement('td');
    tdDiff.className = parseFloat(recalculatedDiff) >= 0 ? 'difference-positive' : 'difference-negative';
    tdDiff.textContent = recalculatedDiff;
    
    const tdActions = document.createElement('td');
    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.textContent = '编辑';
    editBtn.onclick = () => editRecord(item.id);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '删除';
    deleteBtn.onclick = () => del(item.id);
    
    tdActions.appendChild(editBtn);
    tdActions.appendChild(document.createTextNode(' '));
    tdActions.appendChild(deleteBtn);
    
    tr.appendChild(tdDate);
    tr.appendChild(tdStage);
    tr.appendChild(tdM1);
    tr.appendChild(tdM2);
    tr.appendChild(tdM3);
    tr.appendChild(tdParts);
    tr.appendChild(tdStageExpectation);
    tr.appendChild(tdTotalModules);
    tr.appendChild(tdPartsToMod);
    tr.appendChild(tdProduction);
    tr.appendChild(tdDiff);
    tr.appendChild(tdActions);
    
    historyTable.appendChild(tr);
  });
}



// 删除记录
window.del = (id) => {
    if (!confirm('确定删除这条记录？')) return;
    materialRecords = materialRecords.filter(i => i.id !== id);
    save();
    renderTable();
    updateStats();
  renderCharts();
};

// 月度统计显示函数
function updateMonthlyStatsDisplay(monthlyData) {
    const container = document.getElementById('monthly-stats-container');
    const detailSection = document.getElementById('monthly-stats-detail');
    
    if (Object.keys(monthlyData).length === 0) {
        detailSection.style.display = 'none';
        return;
    }
    
    // 按时间排序
    const sortedMonths = Object.values(monthlyData).sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
    });
    
    let html = '';
    sortedMonths.forEach(month => {
        // 重新计算月度期望产出 - 始终使用每条记录自身保存的期望，确保历史数据稳定性
        let monthExpected = 0;
        month.records.forEach(record => {
            monthExpected += getRecordExpectation(record);
        });
        
        console.log(`月度详细统计 - ${month.monthName}:`);
        console.log(`  - 使用每条记录自身保存的期望计算`);
        console.log(`  - 期望产出: ${monthExpected.toFixed(2)} (各记录期望产出之和)`);
        
        monthExpected = monthExpected.toFixed(2);
        const monthDiff = (month.totalModules - monthExpected).toFixed(2);
        const diffClass = parseFloat(monthDiff) >= 0 ? 'difference-positive' : 'difference-negative';
        
        html += `
            <div class="monthly-stat-card">
                <div class="monthly-stat-header">
                    <h4>${month.year}年 ${month.monthName}</h4>
                    <span class="days-count">记录天数: ${month.days}/${month.daysInMonth}</span>
                </div>
                <div class="monthly-stat-content">
                    <div class="monthly-stat-item">
                        <span class="label">实际产出:</span>
                        <span class="value">${month.totalModules.toFixed(2)}</span>
                    </div>
                    <div class="monthly-stat-item">
                        <span class="label">期望产出:</span>
                        <span class="value">${monthExpected}</span>
                    </div>
                    <div class="monthly-stat-item">
                        <span class="label">差值:</span>
                        <span class="value ${diffClass}">${monthDiff}</span>
                    </div>
                    <div class="monthly-stat-item">
                        <span class="label">日均产出:</span>
                        <span class="value">${month.avgDailyModules}</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    detailSection.style.display = 'block';
}

// 更新统计
function updateStats() {
    if (currentStatsView === 'daily') {
        // 按天统计逻辑
        let totalMod = 0, totalProd = 0;
        let totalParts = 0, totalPartsToMod = 0;
        
        materialRecords.forEach(i => {
            totalMod += i.totalModules;
            totalParts += i.parts;
            
            // 重新计算总产出量以确保准确性
            const partsToMod = i.parts / 100;
            const recalculatedProduction = i.totalModules + partsToMod;
            totalProd += recalculatedProduction;
            totalPartsToMod += partsToMod;
            
            console.log(`记录详情 - 日期:${i.date}, 模组:${i.totalModules}, 零件:${i.parts}, 零件换算:${partsToMod.toFixed(2)}, 原总产出:${i.totalProduction}, 重算总产出:${recalculatedProduction.toFixed(2)}`);
        });
        
        console.log(`按天统计 - 总模组:${totalMod}, 总零件:${totalParts}, 总零件换算:${totalPartsToMod.toFixed(2)}, 总产出:${totalProd}`);
        
        // 重新计算期望产出总量 - 基于每条记录的实际期望产出值相加
        let expectTotal = 0;
        materialRecords.forEach(i => {
            const recordExpectation = getRecordExpectation(i);
            expectTotal += recordExpectation;
            console.log(`  - ${i.date}: 期望=${recordExpectation} (阶段=${i.stage || `${i.stage1}/${i.stage2}/${i.stage3}`}, 双倍=${i.isDouble})`);
        });
        
        const diffTotal = totalMod - expectTotal;
        const diffTotalWithParts = totalProd - expectTotal;
        
        console.log(`按天统计期望计算:`);
        console.log(`- 记录天数: ${materialRecords.length}`);
        console.log(`- 期望产出总量: ${expectTotal.toFixed(2)} (各记录期望产出之和)`);

        const avgDailyMod = materialRecords.length > 0 ? (totalMod / materialRecords.length).toFixed(2) : 0;
        const avgDailyProd = materialRecords.length > 0 ? (totalProd / materialRecords.length).toFixed(2) : 0;
        
        actualTotalEl.textContent = `${totalMod.toFixed(2)} (日均: ${avgDailyMod})`;
        expectedTotalEl.textContent = expectTotal.toFixed(2);
        differenceTotalEl.textContent = diffTotal.toFixed(2);
        productionTotalEl.textContent = `${totalProd.toFixed(2)} (日均: ${avgDailyProd})`;
        
        console.log(`按天统计汇总 - 总模组=${totalMod.toFixed(2)}, 总产出(含零件)=${totalProd.toFixed(2)}, 总期望=${expectTotal.toFixed(2)}, 记录天数=${materialRecords.length}, 日均模组=${avgDailyMod}, 日均产出=${avgDailyProd}`);
    } else {
        // 按月统计逻辑 - 更智能的实现
        const monthlyData = {};
        const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', 
                           '七月', '八月', '九月', '十月', '十一月', '十二月'];
        
        // 按月份分组数据
        materialRecords.forEach(record => {
            const date = new Date(record.date);
            const monthKey = record.date.substring(0, 7); // YYYY-MM格式
            const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
            
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = {
                    year: date.getFullYear(),
                    month: date.getMonth(),
                    monthName: monthNames[date.getMonth()],
                    totalModules: 0,
                    totalProduction: 0,
                    days: 0,
                    daysInMonth: daysInMonth,
                    records: [],
                    avgDailyModules: 0,
                    avgDailyProduction: 0
                };
            }
            
            // 重新计算总产出量以确保准确性
            const partsToMod = record.parts / 100;
            const recalculatedProduction = record.totalModules + partsToMod;
            
            monthlyData[monthKey].totalModules += record.totalModules;
            monthlyData[monthKey].totalProduction += recalculatedProduction;
            monthlyData[monthKey].days++;
            monthlyData[monthKey].records.push(record);
            
            console.log(`月度统计 - 记录: 模组=${record.totalModules}, 零件=${record.parts}, 零件换算=${partsToMod.toFixed(2)}, 总产出=${recalculatedProduction.toFixed(2)}`);
        });
        
        // 计算每月统计数据
        Object.values(monthlyData).forEach(month => {
            month.avgDailyModules = month.days > 0 ? (month.totalModules / month.days).toFixed(2) : 0;
            month.avgDailyProduction = month.days > 0 ? (month.totalProduction / month.days).toFixed(2) : 0;
            console.log(`月度统计 - ${month.monthName}: 总模组=${month.totalModules}, 总产出=${month.totalProduction}, 日均产出=${month.avgDailyProduction}`);
        });
        
        // 计算总数据
        let totalMod = 0, totalProd = 0, totalExpected = 0, totalDays = 0;
        Object.values(monthlyData).forEach(month => {
            totalMod += month.totalModules;
            totalProd += month.totalProduction;
            totalDays += month.days;
            
            // 计算月度期望产出 - 始终使用每条记录自身保存的期望，确保历史数据稳定性
            let monthExpected = 0;
            month.records.forEach(record => {
                monthExpected += getRecordExpectation(record);
            });
            
            console.log(`月度统计 - ${month.monthName}:`);
            console.log(`  - 使用每条记录自身保存的期望计算`);
            console.log(`  - 期望产出: ${monthExpected.toFixed(2)} (各记录期望产出之和)`);
            console.log(`  - 详细记录:`);
            month.records.forEach(record => {
                const stageDisplay = record.stage1 ? `${record.stage1}/${record.stage2}/${record.stage3}` : record.stage;
                console.log(`    - ${record.date}: 期望=${getRecordExpectation(record)} (阶段=${stageDisplay}, 双倍=${record.isDouble})`);
            });
            
            totalExpected += monthExpected;
        });
        
        const diffTotal = totalMod - totalExpected;
        const diffTotalWithParts = totalProd - totalExpected;
        const avgDailyMod = totalDays > 0 ? (totalMod / totalDays).toFixed(2) : 0;
        const avgDailyProd = totalDays > 0 ? (totalProd / totalDays).toFixed(2) : 0;
        
        // 更新显示
        actualTotalEl.textContent = `${totalMod.toFixed(2)} (日均: ${avgDailyMod})`;
        expectedTotalEl.textContent = totalExpected.toFixed(2);
        differenceTotalEl.textContent = diffTotal.toFixed(2);
        productionTotalEl.textContent = `${totalProd.toFixed(2)} (日均: ${avgDailyProd})`;
        
        console.log(`月度统计汇总 - 总模组=${totalMod.toFixed(2)}, 总产出(含零件)=${totalProd.toFixed(2)}, 总期望=${totalExpected.toFixed(2)}, 模组差值=${diffTotal.toFixed(2)}, 总产出差值=${diffTotalWithParts.toFixed(2)}`);
        
        // 添加月度统计信息到页面
        updateMonthlyStatsDisplay(monthlyData);
    }
}

// ==================== 图表功能 ====================
let trendChart = null;
let distributionChart = null;
let currentChartView = 'trend';

function initCharts() {
    const trendBtn = document.getElementById('chart-trend');
    const distBtn = document.getElementById('chart-distribution');
    
    if (trendBtn) {
        trendBtn.addEventListener('click', () => {
            switchChart('trend');
        });
    }
    
    if (distBtn) {
        distBtn.addEventListener('click', () => {
            switchChart('distribution');
        });
    }
}

function switchChart(type) {
    currentChartView = type;
    const trendBtn = document.getElementById('chart-trend');
    const distBtn = document.getElementById('chart-distribution');
    const trendCanvas = document.getElementById('trendChart');
    const distCanvas = document.getElementById('distributionChart');
    
    // 更新按钮状态
    if (trendBtn) trendBtn.classList.toggle('active', type === 'trend');
    if (distBtn) distBtn.classList.toggle('active', type === 'distribution');
    
    // 切换显示
    if (trendCanvas) trendCanvas.style.display = type === 'trend' ? 'block' : 'none';
    if (distCanvas) distCanvas.style.display = type === 'distribution' ? 'block' : 'none';
    
    // 渲染图表
    renderCharts();
}

function renderCharts() {
    if (currentChartView === 'trend') {
        renderTrendChart();
    } else {
        renderDistributionChart();
    }
}

function renderTrendChart() {
    const canvas = document.getElementById('trendChart');
    if (!canvas) return;
    
    // 销毁旧图表
    if (trendChart) {
        trendChart.destroy();
    }
    
    const sortedRecords = [...materialRecords].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const labels = sortedRecords.map(r => r.date);
    const moduleData = sortedRecords.map(r => r.totalModules);
    const expectationData = sortedRecords.map(r => getRecordExpectation(r));
    const productionData = sortedRecords.map(r => parseFloat(r.totalProduction));
    
    const ctx = canvas.getContext('2d');
    
    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '模组产出',
                    data: moduleData,
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.3,
                    fill: true
                },
                {
                    label: '期望产出',
                    data: expectationData,
                    borderColor: 'rgb(251, 191, 36)',
                    backgroundColor: 'rgba(251, 191, 36, 0.1)',
                    tension: 0.3,
                    borderDash: [5, 5],
                    fill: false
                },
                {
                    label: '总产出（含零件）',
                    data: productionData,
                    borderColor: 'rgb(34, 197, 94)',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    tension: 0.3,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                title: {
                    display: true,
                    text: '产出趋势图'
                },
                legend: {
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function renderDistributionChart() {
    const canvas = document.getElementById('distributionChart');
    if (!canvas) return;
    
    // 销毁旧图表
    if (distributionChart) {
        distributionChart.destroy();
    }
    
    // 按阶段统计（按获取次数统计，兼容新旧数据格式）
    const stageCounts = { '5': 0, '6': 0, '7': 0 };
    const stageModuleTotals = { '5': 0, '6': 0, '7': 0 };
    
    materialRecords.forEach(r => {
      if (r.stage1 !== undefined) {
        // 新数据格式：统计每次获取
        const modulesPerAcquisition = r.totalModules / 3;
        stageCounts[r.stage1]++;
        stageModuleTotals[r.stage1] += modulesPerAcquisition;
        stageCounts[r.stage2]++;
        stageModuleTotals[r.stage2] += modulesPerAcquisition;
        stageCounts[r.stage3]++;
        stageModuleTotals[r.stage3] += modulesPerAcquisition;
      } else if (stageCounts[r.stage] !== undefined) {
        // 旧数据格式：整条记录算3次获取
        stageCounts[r.stage] += 3;
        stageModuleTotals[r.stage] += r.totalModules;
      }
    });
    
    const labels = ['5阶段', '6阶段', '7阶段'];
    const countData = [stageCounts['5'], stageCounts['6'], stageCounts['7']];
    const moduleData = [stageModuleTotals['5'], stageModuleTotals['6'], stageModuleTotals['7']];
    
    const ctx = canvas.getContext('2d');
    
    distributionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '获取次数',
                    data: countData,
                    backgroundColor: 'rgba(99, 102, 241, 0.8)',
                    yAxisID: 'y'
                },
                {
                    label: '模组总数',
                    data: moduleData,
                    backgroundColor: 'rgba(236, 72, 153, 0.8)',
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                title: {
                    display: true,
                    text: '各阶段产出分布（按获取次数）'
                },
                legend: {
                    position: 'top'
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: '记录次数'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: '模组总数'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
}

// ==================== 新增 UI 功能 ====================

// 1. 筛选和搜索功能
function applyFilters(records) {
  return records.filter(record => {
    // 日期范围筛选
    if (filterState.startDate && record.date < filterState.startDate) {
      return false;
    }
    if (filterState.endDate && record.date > filterState.endDate) {
      return false;
    }
    
    // 阶段筛选 - 匹配任一阶段
    if (filterState.stage) {
      if (record.stage1 !== undefined) {
        // 新数据格式：检查三次获取中是否有匹配的阶段
        if (record.stage1 !== filterState.stage && 
            record.stage2 !== filterState.stage && 
            record.stage3 !== filterState.stage) {
          return false;
        }
      } else {
        // 旧数据格式
        if (record.stage !== filterState.stage) {
          return false;
        }
      }
    }
    
    // 搜索筛选
    if (filterState.search) {
      const searchTerm = filterState.search.toLowerCase();
      let stageStr = '';
      if (record.stage1 !== undefined) {
        stageStr = `${record.stage1}/${record.stage2}/${record.stage3}`;
      } else {
        stageStr = record.stage || '';
      }
      if (!record.date.toLowerCase().includes(searchTerm) && 
          !stageStr.toLowerCase().includes(searchTerm) &&
          !String(record.totalModules).includes(searchTerm)) {
        return false;
      }
    }
    
    return true;
  });
}

// 更新 renderTable 函数以支持筛选
const originalRenderTable = renderTable;
renderTable = function() {
  historyTable.innerHTML = '';
  
  // 先应用筛选
  let filteredRecords = applyFilters(materialRecords);
  
  if (filteredRecords.length === 0) {
    noRecords.style.display = 'block';
    return;
  }
  noRecords.style.display = 'none';

  let list = [...filteredRecords].sort((a, b) => new Date(b.date) - new Date(a.date));
  if (currentSortBy === 'diff') list.sort((a, b) => b.diff - a.diff);

  const thead = historyTable.parentElement.querySelector('thead tr');
  if (thead) {
    thead.innerHTML = `
      <th class="select-column">
        <input type="checkbox" id="head-select-all" onchange="toggleSelectAll(this.checked)">
      </th>
      <th>日期</th>
      <th>阶段</th>
      <th class="mobile-hide">第一次</th>
      <th class="mobile-hide">第二次</th>
      <th class="mobile-hide">第三次</th>
      <th>零件</th>
      <th>模组总数</th>
      <th class="mobile-hide">零件换算</th>
      <th class="mobile-hide">总产出</th>
      <th>差值</th>
      <th>操作</th>
    `;
  }

  list.forEach(item => {
    const recalculatedPartsToMod = (item.parts / 100).toFixed(2);
    const recalculatedProduction = (item.totalModules + parseFloat(recalculatedPartsToMod)).toFixed(2);
    
    const expectedValue = getRecordExpectation(item);
    const recalculatedDiff = (item.totalModules - expectedValue).toFixed(2);
    
    // 构建阶段显示文本
    let stageDisplay = '';
    if (item.stage1 !== undefined) {
      stageDisplay = `${item.stage1}/${item.stage2}/${item.stage3}`;
    } else {
      stageDisplay = item.stage || '-';
    }
    
    const tr = document.createElement('tr');
    
    // 添加选择列（带复选框）
    const tdSelect = document.createElement('td');
    tdSelect.className = 'select-column';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'record-checkbox';
    checkbox.setAttribute('data-id', item.id);
    
    // 如果已经被选中，标记为选中
    if (selectedRecordIds.has(item.id)) {
      checkbox.checked = true;
      tr.classList.add('selected');
    }
    
    // 绑定选择事件
    checkbox.addEventListener('change', function() {
      handleRecordSelection(this);
    });
    
    tdSelect.appendChild(checkbox);
    
    const tdDate = document.createElement('td');
    tdDate.textContent = item.date;
    
    const tdStage = document.createElement('td');
    tdStage.textContent = stageDisplay;
    
    const tdM1 = document.createElement('td');
    tdM1.className = 'mobile-hide';
    tdM1.textContent = item.m1;
    
    const tdM2 = document.createElement('td');
    tdM2.className = 'mobile-hide';
    tdM2.textContent = item.m2;
    
    const tdM3 = document.createElement('td');
    tdM3.className = 'mobile-hide';
    tdM3.textContent = item.m3;
    
    const tdParts = document.createElement('td');
    tdParts.textContent = item.parts;
    if (item.isDouble) {
      const badge = document.createElement('span');
      badge.className = 'double-badge';
      badge.textContent = 'X2';
      tdParts.appendChild(document.createTextNode(' '));
      tdParts.appendChild(badge);
    }
    
    const tdTotalModules = document.createElement('td');
    tdTotalModules.textContent = item.totalModules;
    
    const tdPartsToMod = document.createElement('td');
    tdPartsToMod.className = 'mobile-hide';
    tdPartsToMod.textContent = recalculatedPartsToMod;
    
    const tdProduction = document.createElement('td');
    tdProduction.className = 'production-value mobile-hide';
    tdProduction.textContent = recalculatedProduction;
    
    const tdDiff = document.createElement('td');
    tdDiff.className = parseFloat(recalculatedDiff) >= 0 ? 'difference-positive' : 'difference-negative';
    tdDiff.textContent = recalculatedDiff;
    
    const tdActions = document.createElement('td');
    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.textContent = '编辑';
    editBtn.onclick = () => editRecord(item.id);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '删除';
    deleteBtn.onclick = () => del(item.id);
    
    tdActions.appendChild(editBtn);
    tdActions.appendChild(document.createTextNode(' '));
    tdActions.appendChild(deleteBtn);
    
    // 按正确顺序添加所有列
    tr.appendChild(tdSelect);
    tr.appendChild(tdDate);
    tr.appendChild(tdStage);
    tr.appendChild(tdM1);
    tr.appendChild(tdM2);
    tr.appendChild(tdM3);
    tr.appendChild(tdParts);
    tr.appendChild(tdTotalModules);
    tr.appendChild(tdPartsToMod);
    tr.appendChild(tdProduction);
    tr.appendChild(tdDiff);
    tr.appendChild(tdActions);
    
    historyTable.appendChild(tr);
  });
};

// 2. 浮动操作按钮功能
function initFAB() {
  const fabMain = document.getElementById('fab-main');
  const fabExportJson = document.getElementById('fab-export-json');
  const fabExportCsv = document.getElementById('fab-export-csv');
  const fabImport = document.getElementById('fab-import');
  
  if (fabMain) {
    fabMain.addEventListener('click', function() {
      this.classList.toggle('open');
    });
  }
  
  if (fabExportJson) {
    fabExportJson.addEventListener('click', function(e) {
      e.stopPropagation();
      document.getElementById('export-data').click();
    });
  }
  
  if (fabExportCsv) {
    fabExportCsv.addEventListener('click', function(e) {
      e.stopPropagation();
      document.getElementById('export-csv-data').click();
    });
  }
  
  if (fabImport) {
    fabImport.addEventListener('click', function(e) {
      e.stopPropagation();
      document.getElementById('import-data').click();
    });
  }
}

// 3. 键盘快捷键
function initKeyboardShortcuts() {
  document.addEventListener('keydown', function(e) {
    // Ctrl+S 保存记录
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      const submitBtn = document.querySelector('.submit-btn');
      if (submitBtn) {
        submitBtn.click();
      }
    }
    
    // ESC 重置表单
    if (e.key === 'Escape') {
      resetForm();
    }
    
    // 数字键 1-3 快速切换主题
    if (e.ctrlKey || e.metaKey) {
      if (e.key === '1') {
        e.preventDefault();
        applyNewTheme(THEMES.DARK);
      } else if (e.key === '2') {
        e.preventDefault();
        applyNewTheme(THEMES.LIGHT);
      } else if (e.key === '3') {
        e.preventDefault();
        applyNewTheme(THEMES.NIKKE);
      }
    }
  });
}

function applyNewTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  
  // 更新按钮状态
  const themeOptionBtns = document.querySelectorAll('.theme-option-btn');
  themeOptionBtns.forEach(btn => {
    const btnTheme = btn.getAttribute('data-theme');
    if (btnTheme === theme) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  localStorage.setItem(STORAGE_KEYS.THEME, theme);
  showNotification(`已切换到${theme === 'dark' ? '深色' : theme === 'light' ? '浅色' : 'NIKKE'}主题`, 'info');
}

// 4. 筛选事件绑定
function initFilters() {
  const filterStartDate = document.getElementById('filter-start-date');
  const filterEndDate = document.getElementById('filter-end-date');
  const filterStage = document.getElementById('filter-stage');
  const searchInput = document.getElementById('search-input');
  
  if (filterStartDate) {
    filterStartDate.addEventListener('change', function() {
      filterState.startDate = this.value;
      renderTable();
    });
  }
  
  if (filterEndDate) {
    filterEndDate.addEventListener('change', function() {
      filterState.endDate = this.value;
      renderTable();
    });
  }
  
  if (filterStage) {
    filterStage.addEventListener('change', function() {
      filterState.stage = this.value;
      renderTable();
    });
  }
  
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      filterState.search = this.value;
      renderTable();
    });
  }
}

// 5. 增强图表配置
function enhanceCharts() {
  // 增强趋势图配置
  const originalRenderTrendChart = renderTrendChart;
  renderTrendChart = function() {
    const canvas = document.getElementById('trendChart');
    if (!canvas) return;
    
    if (trendChart) {
      trendChart.destroy();
    }
    
    const sortedRecords = [...materialRecords].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const labels = sortedRecords.map(r => r.date);
    const moduleData = sortedRecords.map(r => r.totalModules);
    const expectationData = sortedRecords.map(r => getRecordExpectation(r));
    const productionData = sortedRecords.map(r => parseFloat(r.totalProduction));
    
    const ctx = canvas.getContext('2d');
    
    trendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: '模组产出',
            data: moduleData,
            borderColor: 'rgb(99, 102, 241)',
            backgroundColor: 'rgba(99, 102, 241, 0.15)',
            tension: 0.4,
            fill: true,
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: '期望产出',
            data: expectationData,
            borderColor: 'rgb(251, 191, 36)',
            backgroundColor: 'rgba(251, 191, 36, 0.1)',
            tension: 0.4,
            borderDash: [8, 4],
            fill: false,
            pointRadius: 3,
            pointHoverRadius: 5
          },
          {
            label: '总产出（含零件）',
            data: productionData,
            borderColor: 'rgb(34, 197, 94)',
            backgroundColor: 'rgba(34, 197, 94, 0.15)',
            tension: 0.4,
            fill: true,
            pointRadius: 4,
            pointHoverRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        animation: {
          duration: 1000,
          easing: 'easeInOutQuart'
        },
        plugins: {
          title: {
            display: true,
            text: '产出趋势图',
            font: {
              size: 18,
              weight: 'bold'
            }
          },
          legend: {
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 20
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            cornerRadius: 8,
            titleFont: {
              size: 14,
              weight: 'bold'
            },
            bodyFont: {
              size: 13
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        }
      }
    });
  };
  
  // 增强分布图配置
  const originalRenderDistributionChart = renderDistributionChart;
  renderDistributionChart = function() {
    const canvas = document.getElementById('distributionChart');
    if (!canvas) return;
    
    if (distributionChart) {
      distributionChart.destroy();
    }
    
    const stageCounts = { '5': 0, '6': 0, '7': 0 };
    const stageModuleTotals = { '5': 0, '6': 0, '7': 0 };
    
    materialRecords.forEach(r => {
      if (stageCounts[r.stage] !== undefined) {
        stageCounts[r.stage]++;
        stageModuleTotals[r.stage] += r.totalModules;
      }
    });
    
    const labels = ['5阶段', '6阶段', '7阶段'];
    const countData = [stageCounts['5'], stageCounts['6'], stageCounts['7']];
    const moduleData = [stageModuleTotals['5'], stageModuleTotals['6'], stageModuleTotals['7']];
    
    const ctx = canvas.getContext('2d');
    
    distributionChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: '记录次数',
            data: countData,
            backgroundColor: 'rgba(99, 102, 241, 0.85)',
            borderColor: 'rgba(99, 102, 241, 1)',
            borderWidth: 2,
            borderRadius: 6,
            yAxisID: 'y'
          },
          {
            label: '模组总数',
            data: moduleData,
            backgroundColor: 'rgba(236, 72, 153, 0.85)',
            borderColor: 'rgba(236, 72, 153, 1)',
            borderWidth: 2,
            borderRadius: 6,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        animation: {
          duration: 1000,
          easing: 'easeInOutQuart'
        },
        plugins: {
          title: {
            display: true,
            text: '各阶段产出分布',
            font: {
              size: 18,
              weight: 'bold'
            }
          },
          legend: {
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 20
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            cornerRadius: 8,
            titleFont: {
              size: 14,
              weight: 'bold'
            },
            bodyFont: {
              size: 13
            }
          }
        },
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: '记录次数',
              font: {
                size: 14,
                weight: 'bold'
              }
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            },
            ticks: {
              precision: 0
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
              display: true,
              text: '模组总数',
              font: {
                size: 14,
                weight: 'bold'
              }
            },
            grid: {
              drawOnChartArea: false
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        }
      }
    });
  };
}

// ==================== 批量录入功能 ====================

// 全局状态
let batchRows = [];

function initBatchInput() {
  const modeTabs = document.querySelectorAll('.mode-tab');
  const singlePanel = document.querySelector('.single-input-panel');
  const batchPanel = document.querySelector('.batch-input-panel');

  // 初始化日期默认值 - 使用本地时间方法
  const now = new Date();
  const todayYear = now.getFullYear();
  const todayMonth = now.getMonth();
  const todayDay = now.getDate();
  
  // 创建今天的 UTC 日期对象
  const today = new Date(Date.UTC(todayYear, todayMonth, todayDay, 12, 0, 0));
  
  // 创建一周前的日期（基于 UTC 日期计算）
  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const batchStartDate = document.getElementById('batch-start-date');
  const batchEndDate = document.getElementById('batch-end-date');
  
  if (batchStartDate) {
    batchStartDate.value = formatDate(lastWeek);
    console.log('批量录入起始日期:', batchStartDate.value);
  }
  if (batchEndDate) {
    batchEndDate.value = formatDate(today);
    console.log('批量录入结束日期:', batchEndDate.value);
  }

  // 模式切换
  modeTabs.forEach(tab => {
    tab.addEventListener('click', function() {
      const mode = this.getAttribute('data-mode');
      
      modeTabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      
      if (mode === 'single') {
        singlePanel.style.display = 'block';
        batchPanel.style.display = 'none';
      } else {
        singlePanel.style.display = 'none';
        batchPanel.style.display = 'block';
        updateBatchSummary();
      }
    });
  });

  // 绑定快捷操作按钮
  bindBatchQuickActions();

  // 绑定批量提交按钮
  bindBatchSubmit();

  console.log('批量录入功能初始化完成！');
}

/**
 * 安全地将 Date 对象格式化为 YYYY-MM-DD 字符串
 * 核心原则：始终使用 UTC 方法，避免时区偏移
 */
function formatDate(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return '';
  }
  // 关键：使用 UTC 方法提取年月日
  // 在东八区，getDate() 可能返回 UTC-8 的日期，而 getUTCDate() 返回正确的 UTC 日期
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 安全地将 YYYY-MM-DD 字符串解析为 Date 对象
 * 只用于需要日期比较的场景（如批量录入的日期范围）
 * 始终使用 UTC 时间构造，避免时区问题
 */
function parseDateSafe(dateString) {
  if (!dateString) return null;
  
  // 如果已经是 Date 对象 - 使用 UTC 方法重新规范化
  if (dateString instanceof Date) {
    if (!isNaN(dateString.getTime())) {
      const y = dateString.getUTCFullYear();
      const m = dateString.getUTCMonth();
      const d = dateString.getUTCDate();
      return new Date(Date.UTC(y, m, d, 12, 0, 0));
    }
    return null;
  }
  
  const trimmed = String(dateString).trim();
  
  // 1. 如果是 YYYY-MM-DD 格式 - 最安全的方式
  const matchISO = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (matchISO) {
    const year = parseInt(matchISO[1], 10);
    const month = parseInt(matchISO[2], 10) - 1; // 月份从0开始
    const day = parseInt(matchISO[3], 10);
    // 关键：使用 Date.UTC() 而不是 new Date(year, month, day)
    // 因为后者会使用本地时区
    return new Date(Date.UTC(year, month, day, 12, 0, 0));
  }
  
  // 2. 如果是 YYYY/MM/DD 格式
  const matchSlash = trimmed.match(/^(\d{4})[\/](\d{1,2})[\/](\d{1,2})$/);
  if (matchSlash) {
    const year = parseInt(matchSlash[1], 10);
    const month = parseInt(matchSlash[2], 10) - 1;
    const day = parseInt(matchSlash[3], 10);
    return new Date(Date.UTC(year, month, day, 12, 0, 0));
  }
  
  // 3. 如果是 M/D/YYYY 格式
  const matchUS = trimmed.match(/^(\d{1,2})[\/](\d{1,2})[\/](\d{4})$/);
  if (matchUS) {
    const month = parseInt(matchUS[1], 10) - 1;
    const day = parseInt(matchUS[2], 10);
    const year = parseInt(matchUS[3], 10);
    return new Date(Date.UTC(year, month, day, 12, 0, 0));
  }
  
  // 4. 其他格式 - 谨慎处理，避免使用 new Date(string)
  // 直接从字符串中提取数字
  const numbers = trimmed.match(/\d+/g);
  if (numbers && numbers.length >= 3) {
    let year, month, day;
    
    // 找年份（大于1000的数字）
    const yearIdx = numbers.findIndex(n => parseInt(n) > 1000);
    if (yearIdx !== -1) {
      year = parseInt(numbers[yearIdx], 10);
      const others = numbers.filter((_, i) => i !== yearIdx).map(n => parseInt(n, 10));
      if (others.length >= 2) {
        // 月和日 - 假设较小的是月，较大的是日
        const min = Math.min(others[0], others[1]);
        const max = Math.max(others[0], others[1]);
        month = (min <= 12 ? min : max) - 1;
        day = min <= 12 ? max : min;
        return new Date(Date.UTC(year, month, day, 12, 0, 0));
      }
    }
  }
  
  // 无法解析
  return null;
}

/**
 * 获取今天的日期字符串（YYYY-MM-DD），基于本地时间
 */
function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 从 YYYY-MM-DD 字符串中提取年月日（无需解析为 Date 对象）
 */
function extractDateParts(dateString) {
  if (!dateString) return null;
  
  const match = String(dateString).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return {
      year: parseInt(match[1], 10),
      month: parseInt(match[2], 10),
      day: parseInt(match[3], 10)
    };
  }
  return null;
}

function bindBatchQuickActions() {
  const generateBtn = document.getElementById('btn-generate-rows');
  const fillPartsBtn = document.getElementById('btn-fill-default-parts');
  const copyModulesBtn = document.getElementById('btn-copy-down-modules');
  const clearBtn = document.getElementById('btn-clear-all');

  if (generateBtn) {
    generateBtn.addEventListener('click', generateBatchRows);
  }

  if (fillPartsBtn) {
    fillPartsBtn.addEventListener('click', fillDefaultParts);
  }

  if (copyModulesBtn) {
    copyModulesBtn.addEventListener('click', copyModulesToAll);
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', clearAllBatchRows);
  }
}

function generateBatchRows() {
  const startDateInput = document.getElementById('batch-start-date');
  const endDateInput = document.getElementById('batch-end-date');
  const defaultStage = document.getElementById('batch-default-stage').value;
  const tbody = document.getElementById('batch-table-body');
  const emptyHint = document.getElementById('batch-empty-hint');

  if (!startDateInput.value || !endDateInput.value) {
    showNotification('请选择起始和结束日期', 'error');
    return;
  }

  // 使用安全的日期解析方法
  const startDate = parseDateSafe(startDateInput.value);
  const endDate = parseDateSafe(endDateInput.value);

  if (!startDate || !endDate) {
    showNotification('日期格式不正确', 'error');
    return;
  }

  if (startDate > endDate) {
    showNotification('起始日期不能晚于结束日期', 'error');
    return;
  }

  console.log(`生成批量记录: 从 ${formatDate(startDate)} 到 ${formatDate(endDate)}`);

  // 生成日期范围内的所有行 - 使用字符串直接处理避免时区问题
  batchRows = [];
  
  // 从输入字符串直接提取年月日
  const startParts = extractDateParts(startDateInput.value);
  const endParts = extractDateParts(endDateInput.value);
  
  if (startParts && endParts) {
    // 更安全的日期生成方式：使用年月日直接生成
    let currentYear = startParts.year;
    let currentMonth = startParts.month;
    let currentDay = startParts.day;
    
    while (true) {
      // 构造当前日期字符串
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
      
      // 检查该日期是否已经有记录
      const hasExistingRecord = materialRecords.some(r => r.date === dateStr);
      
      if (!hasExistingRecord) {
        batchRows.push({
          date: dateStr,
          stage: defaultStage,
          m1: 0,
          m2: 0,
          m3: 0,
          parts: STAGE_PARTS[defaultStage] || 0,
          isDouble: false
        });
        console.log(`生成记录行: ${dateStr}`);
      } else {
        console.log(`日期 ${dateStr} 已有记录，跳过`);
      }
      
      // 检查是否到达结束日期
      if (currentYear === endParts.year && 
          currentMonth === endParts.month && 
          currentDay === endParts.day) {
        break;
      }
      
      // 增加一天 - 用 Date 对象处理月份年份进位
      const tempDate = new Date(Date.UTC(currentYear, currentMonth - 1, currentDay, 12, 0, 0));
      tempDate.setUTCDate(tempDate.getUTCDate() + 1);
      
      currentYear = tempDate.getUTCFullYear();
      currentMonth = tempDate.getUTCMonth() + 1;
      currentDay = tempDate.getUTCDate();
    }
  } else {
    // 如果字符串解析失败，回退到安全解析方式
    const currentDate = new Date(startDate.getTime());
    
    while (currentDate <= endDate) {
      const dateStr = formatDate(currentDate);
      
      const hasExistingRecord = materialRecords.some(r => r.date === dateStr);
      
      if (!hasExistingRecord) {
        batchRows.push({
          date: dateStr,
          stage: defaultStage,
          m1: 0,
          m2: 0,
          m3: 0,
          parts: STAGE_PARTS[defaultStage] || 0,
          isDouble: false
        });
      }
      
      // 使用 UTC 日期增加避免时区问题
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
  }

  if (batchRows.length === 0) {
    showNotification('所选日期范围内所有日期都已有记录', 'info');
    return;
  }

  renderBatchTable();
  updateBatchSummary();
  
  if (emptyHint) {
    emptyHint.style.display = batchRows.length === 0 ? 'block' : 'none';
  }

  showNotification(`成功生成 ${batchRows.length} 条记录行`, 'success');
  console.log(`批量记录生成完成，共 ${batchRows.length} 条`);
}

function renderBatchTable() {
  const tbody = document.getElementById('batch-table-body');
  const emptyHint = document.getElementById('batch-empty-hint');
  
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  if (batchRows.length === 0) {
    if (emptyHint) {
      emptyHint.style.display = 'block';
    }
    return;
  }

  if (emptyHint) {
    emptyHint.style.display = 'none';
  }

  batchRows.forEach((row, index) => {
    const tr = document.createElement('tr');
    
    // 日期
    const tdDate = document.createElement('td');
    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.value = row.date;
    dateInput.addEventListener('change', function() {
      batchRows[index].date = this.value;
      updateBatchSummary();
    });
    tdDate.appendChild(dateInput);
    
    // 阶段
    const tdStage = document.createElement('td');
    const stageSelect = document.createElement('select');
    ['5', '6', '7'].forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = `${s}阶段`;
      if (row.stage === s) opt.selected = true;
      stageSelect.appendChild(opt);
    });
    stageSelect.addEventListener('change', function() {
      batchRows[index].stage = this.value;
      updateBatchSummary();
    });
    tdStage.appendChild(stageSelect);
    
    // 第一次获取
    const tdM1 = document.createElement('td');
    const m1Input = document.createElement('input');
    m1Input.type = 'number';
    m1Input.min = '0';
    m1Input.value = row.m1;
    m1Input.addEventListener('input', function() {
      batchRows[index].m1 = +this.value || 0;
      updateRowSubtotal(tr, batchRows[index]);
      updateBatchSummary();
    });
    tdM1.appendChild(m1Input);
    
    // 第二次获取
    const tdM2 = document.createElement('td');
    const m2Input = document.createElement('input');
    m2Input.type = 'number';
    m2Input.min = '0';
    m2Input.value = row.m2;
    m2Input.addEventListener('input', function() {
      batchRows[index].m2 = +this.value || 0;
      updateRowSubtotal(tr, batchRows[index]);
      updateBatchSummary();
    });
    tdM2.appendChild(m2Input);
    
    // 第三次获取
    const tdM3 = document.createElement('td');
    const m3Input = document.createElement('input');
    m3Input.type = 'number';
    m3Input.min = '0';
    m3Input.value = row.m3;
    m3Input.addEventListener('input', function() {
      batchRows[index].m3 = +this.value || 0;
      updateRowSubtotal(tr, batchRows[index]);
      updateBatchSummary();
    });
    tdM3.appendChild(m3Input);
    
    // 零件
    const tdParts = document.createElement('td');
    const partsInput = document.createElement('input');
    partsInput.type = 'number';
    partsInput.min = '0';
    partsInput.value = row.parts;
    partsInput.addEventListener('input', function() {
      batchRows[index].parts = +this.value || 0;
      updateBatchSummary();
    });
    tdParts.appendChild(partsInput);
    
    // 双倍
    const tdDouble = document.createElement('td');
    const doubleCheckbox = document.createElement('input');
    doubleCheckbox.type = 'checkbox';
    doubleCheckbox.checked = row.isDouble;
    doubleCheckbox.addEventListener('change', function() {
      batchRows[index].isDouble = this.checked;
      updateBatchSummary();
    });
    tdDouble.appendChild(doubleCheckbox);
    
    // 小计
    const tdSubtotal = document.createElement('td');
    tdSubtotal.className = 'batch-subtotal';
    updateRowSubtotal(tr, row);
    
    // 删除按钮
    const tdDelete = document.createElement('td');
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'batch-row-delete';
    deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
    deleteBtn.addEventListener('click', function() {
      batchRows.splice(index, 1);
      renderBatchTable();
      updateBatchSummary();
    });
    tdDelete.appendChild(deleteBtn);
    
    tr.appendChild(tdDate);
    tr.appendChild(tdStage);
    tr.appendChild(tdM1);
    tr.appendChild(tdM2);
    tr.appendChild(tdM3);
    tr.appendChild(tdParts);
    tr.appendChild(tdDouble);
    tr.appendChild(tdSubtotal);
    tr.appendChild(tdDelete);
    
    tbody.appendChild(tr);
  });
}

function updateRowSubtotal(tr, row) {
  const totalModules = row.m1 + row.m2 + row.m3;
  const partsToMod = (row.parts * (row.isDouble ? 2 : 1) / 100).toFixed(2);
  const subtotal = document.createElement('span');
  subtotal.textContent = totalModules;
  
  const subtotalTd = tr.querySelectorAll('td')[7];
  if (subtotalTd) {
    subtotalTd.innerHTML = '';
    subtotalTd.appendChild(subtotal);
  }
}

function updateBatchSummary() {
  const summaryCount = document.getElementById('batch-summary-count');
  const summaryModules = document.getElementById('batch-summary-modules');
  const summaryParts = document.getElementById('batch-summary-parts');
  const summaryPartsToModules = document.getElementById('batch-summary-parts-to-modules');

  let totalModules = 0;
  let totalParts = 0;

  batchRows.forEach(row => {
    totalModules += row.m1 + row.m2 + row.m3;
    totalParts += row.parts * (row.isDouble ? 2 : 1);
  });

  if (summaryCount) summaryCount.textContent = batchRows.length;
  if (summaryModules) summaryModules.textContent = totalModules;
  if (summaryParts) summaryParts.textContent = totalParts;
  if (summaryPartsToModules) summaryPartsToModules.textContent = (totalParts / 100).toFixed(2);
}

function fillDefaultParts() {
  const defaultStage = document.getElementById('batch-default-stage').value;
  const defaultParts = STAGE_PARTS[defaultStage] || 0;
  
  batchRows.forEach(row => {
    row.parts = defaultParts;
  });

  renderBatchTable();
  updateBatchSummary();
  showNotification(`已填充 ${defaultStage}阶段的默认零件数量: ${defaultParts}`, 'success');
}

function copyModulesToAll() {
  if (batchRows.length === 0) {
    showNotification('请先生成记录行', 'error');
    return;
  }

  // 使用第一行的模组数量作为模板
  const template = batchRows[0];
  
  if (template.m1 === 0 && template.m2 === 0 && template.m3 === 0) {
    showNotification('请先在第一行输入模组数量', 'error');
    return;
  }

  batchRows.forEach((row, index) => {
    if (index !== 0) {
      row.m1 = template.m1;
      row.m2 = template.m2;
      row.m3 = template.m3;
    }
  });

  renderBatchTable();
  updateBatchSummary();
  showNotification('已将第一行的模组数量复制到所有行', 'success');
}

function clearAllBatchRows() {
  if (batchRows.length === 0) {
    showNotification('没有记录需要清空', 'info');
    return;
  }

  if (confirm('确定要清空所有记录行吗？')) {
    batchRows = [];
    renderBatchTable();
    updateBatchSummary();
    showNotification('已清空所有记录行', 'info');
  }
}

function bindBatchSubmit() {
  const submitBtn = document.getElementById('btn-batch-submit');
  
  if (submitBtn) {
    submitBtn.addEventListener('click', function() {
      if (batchRows.length === 0) {
        showNotification('没有可提交的记录，请先生成并填写数据', 'error');
        return;
      }

      // 验证数据
      let validCount = 0;
      let skippedDates = [];
      const newRecords = [];

      batchRows.forEach(row => {
        // 检查日期是否重复
        if (materialRecords.some(r => r.date === row.date)) {
          skippedDates.push(row.date);
          return;
        }

        // 验证必填字段
        if (!row.date || !row.stage) {
          return;
        }

        const finalParts = row.isDouble ? row.parts * 2 : row.parts;
        const totalModules = row.m1 + row.m2 + row.m3;
        const partsToMod = (finalParts / 100).toFixed(2);
        const totalProduction = (totalModules + parseFloat(partsToMod)).toFixed(2);
        
        // 根据阶段计算期望产出
        const stageExpectation = getStageExpectation(row.stage, row.isDouble);
        const diff = (totalModules - stageExpectation).toFixed(2);

        newRecords.push({
          id: Date.now() + Math.random(),
          date: row.date,
          m1: row.m1,
          m2: row.m2,
          m3: row.m3,
          parts: finalParts,
          stage: row.stage,
          isDouble: row.isDouble,
          totalModules: totalModules,
          partsToMod: partsToMod,
          totalProduction: totalProduction,
          diff: diff,
          stageExpectation: stageExpectation
        });

        validCount++;
      });

      if (validCount === 0) {
        showNotification('没有有效的记录可以提交', 'error');
        return;
      }

      // 添加新记录到 materialRecords
      materialRecords.push(...newRecords);

      // 保存
      save();

      // 更新UI
      renderTable();
      updateStats();
      renderCharts();

      // 清空批量录入表格
      batchRows = [];
      renderBatchTable();
      updateBatchSummary();

      let message = `成功提交 ${validCount} 条记录！`;
      if (skippedDates.length > 0) {
        message += ` 跳过 ${skippedDates.length} 条已存在的日期。`;
      }

      showNotification(message, 'success');
      console.log('批量提交完成，共添加', validCount, '条新记录');
      
      if (skippedDates.length > 0) {
        console.log('跳过的日期:', skippedDates);
      }
    });
  }
}

// ==================== Excel 导入导出功能 ====================

// 初始化 Excel 功能
function initExcelFeatures() {
  const exportTemplateBtn = document.getElementById('export-excel-template');
  const importExcelBtn = document.getElementById('import-excel-data');
  const excelFileInput = document.getElementById('excel-file-input');

  // 导出 Excel 模板
  if (exportTemplateBtn) {
    exportTemplateBtn.addEventListener('click', exportExcelTemplate);
  }

  // 导入 Excel 数据
  if (importExcelBtn) {
    importExcelBtn.addEventListener('click', function() {
      excelFileInput.click();
    });
  }

  // 处理文件选择
  if (excelFileInput) {
    excelFileInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          importExcelData(e.target.result);
        } catch (error) {
          console.error('Excel 导入失败:', error);
          showNotification('Excel 文件导入失败，请检查文件格式是否正确', 'error');
        }
      };
      reader.readAsArrayBuffer(file);
      e.target.value = '';
    });
  }

  console.log('Excel 功能初始化完成！');
}

// 导出 Excel 模板
function exportExcelTemplate() {
  const templateData = [
    {
      '日期': '2024-01-01',
      '阶段': 7,
      '第一次获取': 0,
      '第二次获取': 0,
      '第三次获取': 0,
      '零件数量': 111,
      '是否双倍': '否'
    },
    {
      '日期': '2024-01-02',
      '阶段': 7,
      '第一次获取': 1,
      '第二次获取': 2,
      '第三次获取': 0,
      '零件数量': 111,
      '是否双倍': '是'
    },
    {
      '日期': '2024-01-03',
      '阶段': 6,
      '第一次获取': 2,
      '第二次获取': 1,
      '第三次获取': 1,
      '零件数量': 105,
      '是否双倍': '否'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(templateData);

  // 设置列宽
  ws['!cols'] = [
    { wch: 12 },  // 日期
    { wch: 8 },   // 阶段
    { wch: 10 },  // 第一次获取
    { wch: 10 },  // 第二次获取
    { wch: 10 },  // 第三次获取
    { wch: 10 },  // 零件数量
    { wch: 10 }   // 是否双倍
  ];

  // 创建工作簿
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '材料记录模板');

  // 添加使用说明 Sheet
  const instructions = [
    { 说明: 'NIKKE材料记录工具 - Excel 导入模板' },
    { 说明: '' },
    { 说明: '【填写说明】' },
    { 说明: '1. 日期：格式为 YYYY-MM-DD，例如 2024-01-01' },
    { 说明: '2. 阶段：填写 5、6 或 7' },
    { 说明: '3. 第一次获取 ~ 第三次获取：填写每次获取的模组数量（整数）' },
    { 说明: '4. 零件数量：该次获取的零件数量（整数）' },
    {说明: '5. 是否双倍：填写 "是" 或 "否"' },
    { 说明: '' },
    { 说明: '【注意事项】' },
    { 说明: '- 日期列必填，其他列可为空' },
    { 说明: '- 阶段默认为7阶段（111零件）' },
    { 说明: '- 零件数量根据阶段自动设置：5阶段=81, 6阶段=105, 7阶段=111' },
    { 说明: '- "是"表示双倍产出，零件数量会自动翻倍' },
    { 说明: '- 已有记录的日期会被跳过，不会重复导入' },
    { 说明: '' },
    { 说明: '【示例数据】' },
    { 说明: '请参考第一张工作表中的示例数据' }
  ];

  const wsInstructions = XLSX.utils.json_to_sheet(instructions);
  XLSX.utils.book_append_sheet(wb, wsInstructions, '使用说明');

  const fileName = `NIKKE材料记录模板_${formatDate(new Date())}.xlsx`;
  XLSX.writeFile(wb, fileName);

  showNotification('Excel 模板导出成功！', 'success');
  console.log('Excel 模板导出完成:', fileName);
}

// 从 Excel 导入数据
function importExcelData(arrayBuffer) {
  try {
    const data = new Uint8Array(arrayBuffer);
    // 关键：禁用 cellDates，让我们自己处理日期格式
    // 避免 SheetJS 使用本地时区创建 Date 对象导致跨日
    const workbook = XLSX.read(data, { type: 'array', cellDates: false, cellNF: true });

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // raw: true - 获取单元格的原始值（不格式化）
    // defval: '' - 空单元格默认值为空字符串
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: true, defval: '' });

    if (jsonData.length === 0) {
      showNotification('Excel 文件中没有数据', 'error');
      return;
    }

    // 解析并验证数据
    const validRecords = [];
    const skippedRecords = [];
    const errorRecords = [];

    jsonData.forEach((row, index) => {
      const rowNum = index + 2; // Excel 行号（从2开始，因为第1行是表头）

      try {
        // 提取数据
        const date = row['日期'];
        const stage = parseInt(row['阶段']) || 7;
        const m1 = parseInt(row['第一次获取']) || 0;
        const m2 = parseInt(row['第二次获取']) || 0;
        const m3 = parseInt(row['第三次获取']) || 0;
        const parts = parseInt(row['零件数量']) || STAGE_PARTS[stage] || 111;
        const isDouble = String(row['是否双倍']).trim().toLowerCase() === '是' || 
                         String(row['是否双倍']).trim() === '1' ||
                         String(row['是否双倍']).trim().toLowerCase() === 'true';

        // 验证日期格式
        if (!date) {
          errorRecords.push({ row: rowNum, error: '日期不能为空' });
          return;
        }

        // 调试：显示原始日期和解析结果
        console.log(`行 ${rowNum}: 日期原始值 =`, date, `类型 =`, typeof date);
        
        const dateStr = formatDateValue(date);
        console.log(`行 ${rowNum}: 解析后日期 = ${dateStr}`);
        
        if (!dateStr) {
          errorRecords.push({ row: rowNum, error: '日期格式不正确，请使用 YYYY-MM-DD 格式' });
          return;
        }

        // 检查是否已有记录
        if (materialRecords.some(r => r.date === dateStr)) {
          skippedRecords.push({ date: dateStr, reason: '日期已存在' });
          return;
        }

        // 计算最终值
        const finalParts = isDouble ? parts * 2 : parts;
        const totalModules = m1 + m2 + m3;
        const partsToMod = (finalParts / 100).toFixed(2);
        const totalProduction = (totalModules + parseFloat(partsToMod)).toFixed(2);

        // 根据阶段计算期望产出
        const stageExpectation = getStageExpectation(stage, isDouble);
        const diff = (totalModules - stageExpectation).toFixed(2);

        validRecords.push({
          id: Date.now() + Math.random() + Math.random(),
          date: dateStr,
          m1,
          m2,
          m3,
          parts: finalParts,
          stage,
          isDouble,
          totalModules,
          partsToMod,
          totalProduction,
          diff,
          stageExpectation
        });
      } catch (err) {
        console.error(`处理第 ${rowNum} 行时出错:`, err);
        errorRecords.push({ row: rowNum, error: err.message });
      }
    });

    if (validRecords.length === 0) {
      let errorMsg = '没有找到有效的记录可以导入';
      if (errorRecords.length > 0) {
        errorMsg += `。前 ${Math.min(3, errorRecords.length)} 个错误: ${errorRecords[0].error}`;
        if (errorRecords.length > 1) {
          errorMsg += `; ${errorRecords[1].error}`;
        }
        if (errorRecords.length > 2) {
          errorMsg += ` 等共 ${errorRecords.length} 个错误`;
        }
      }
      if (skippedRecords.length > 0) {
        errorMsg += `。另外有 ${skippedRecords.length} 条记录因日期已存在被跳过`;
      }
      showNotification(errorMsg, 'error');
      console.log('导入结果:', { validRecords, skippedRecords, errorRecords });
      return;
    }

    // 添加有效记录
    materialRecords.push(...validRecords);

    // 保存数据
    save();

    // 更新 UI
    renderTable();
    updateStats();
    renderCharts();

    // 生成结果消息
    let message = `成功导入 ${validRecords.length} 条记录！`;
    if (skippedRecords.length > 0) {
      message += ` 跳过 ${skippedRecords.length} 条已存在的日期。`;
    }
    if (errorRecords.length > 0) {
      message += ` 有 ${errorRecords.length} 条记录导入失败。`;
    }

    showNotification(message, 'success');

    console.log('Excel 导入完成:', {
      成功: validRecords.length,
      跳过: skippedRecords.length,
      错误: errorRecords.length,
      详细: {
        validRecords,
        skippedRecords,
        errorRecords
      }
    });

  } catch (error) {
    console.error('Excel 导入过程出错:', error);
    showNotification('Excel 文件导入失败：' + error.message, 'error');
  }
}

// 格式化日期值 - 完全避免时区问题
function formatDateValue(dateValue) {
  if (!dateValue) return null;

  try {
    // =======================================================
    // 核心原则：把日期当作纯日历值处理，不做任何时区转换
    // 目标：输入 "2024-01-15" → 输出 "2024-01-15"
    // =======================================================

    // 1. 如果已经是 YYYY-MM-DD 格式字符串 - 直接返回！
    if (typeof dateValue === 'string') {
      const trimmed = dateValue.trim();
      
      // 1.1 完美匹配 YYYY-MM-DD → 直接返回
      const matchISO = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (matchISO) {
        return `${matchISO[1]}-${matchISO[2]}-${matchISO[3]}`;
      }
      
      // 1.2 匹配 YYYY/MM/DD 格式（Windows常见）
      const matchSlash = trimmed.match(/^(\d{4})[\/](\d{1,2})[\/](\d{1,2})$/);
      if (matchSlash) {
        const y = parseInt(matchSlash[1], 10);
        const m = parseInt(matchSlash[2], 10);
        const d = parseInt(matchSlash[3], 10);
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
      
      // 1.3 匹配 YYYY/M/D 格式（Excel常见）
      const matchShort = trimmed.match(/^(\d{4})[\/](\d{1,2})[\/](\d{1,2})$/);
      if (matchShort) {
        const y = parseInt(matchShort[1], 10);
        const m = parseInt(matchShort[2], 10);
        const d = parseInt(matchShort[3], 10);
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
      
      // 1.4 匹配 M/D/YYYY 格式（美国格式）
      const matchUS = trimmed.match(/^(\d{1,2})[\/](\d{1,2})[\/](\d{4})$/);
      if (matchUS) {
        const m = parseInt(matchUS[1], 10);
        const d = parseInt(matchUS[2], 10);
        const y = parseInt(matchUS[3], 10);
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
      
      // 1.5 尝试从字符串中提取数字
      const numbers = trimmed.match(/\d+/g);
      if (numbers && numbers.length >= 3) {
        // 尝试各种组合：年-月-日
        let year, month, day;
        
        // 如果有大于1000的数字，应该是年份
        const yearIdx = numbers.findIndex(n => parseInt(n) > 1000);
        if (yearIdx !== -1) {
          year = parseInt(numbers[yearIdx], 10);
          // 其他两个是月日
          const others = numbers.filter((_, i) => i !== yearIdx).map(n => parseInt(n, 10));
          // 假设：较大的（小于13）是月，较小的是日
          if (others.length >= 2) {
            // 第一个是月，第二个是日
            month = Math.min(others[0], others[1]);
            day = Math.max(others[0], others[1]);
            if (month <= 12 && day <= 31) {
              return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            }
          }
        }
      }
      
      // 1.6 其他字符串 - 谨慎使用parseDateSafe（仍可能有问题）
      // 不使用new Date，直接手动解析
      return null;
    }

    // 2. 如果是 Date 对象 - 必须使用UTC方法提取
    if (dateValue instanceof Date) {
      if (!isNaN(dateValue.getTime())) {
        // 关键：始终使用UTC方法，避免本地时区
        const year = dateValue.getUTCFullYear();
        const month = dateValue.getUTCMonth() + 1;
        const day = dateValue.getUTCDate();
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
      return null;
    }

    // 3. 如果是数字（Excel 日期序列号）
    // 例如：45321 表示 2024-01-15
    if (typeof dateValue === 'number' && dateValue > 0 && dateValue < 100000) {
      // 使用 SheetJS 的解析方法，但用 UTC 方式
      const dateCode = XLSX.SSF.parse_date_code(dateValue);
      if (dateCode && dateCode.y !== undefined && 
          dateCode.m !== undefined && 
          dateCode.d !== undefined) {
        // 直接从dateCode提取，不创建Date对象
        const y = dateCode.y;
        const m = dateCode.m;
        const d = dateCode.d;
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
      return null;
    }

    // 4. 其他情况
    return null;
  } catch (error) {
    console.error('日期格式化失败:', error);
    return null;
  }
}

// ==================== 批量选择与删除功能 ====================

// 存储选中的记录ID
let selectedRecordIds = new Set();

// 撤销栈（存储最近删除的记录，最多支持10条）
let deletionUndoStack = [];

/**
 * 初始化批量选择功能
 */
function initBatchSelection() {
  const batchControls = document.getElementById('batch-controls');
  const selectAllCheckbox = document.getElementById('select-all-checkbox');
  const batchDeleteBtn = document.getElementById('batch-delete-btn');
  const batchCancelBtn = document.getElementById('batch-cancel-btn');
  
  // 全选复选框事件
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', function() {
      const checkboxes = document.querySelectorAll('.record-checkbox');
      checkboxes.forEach(checkbox => {
        checkbox.checked = this.checked;
        const recordId = parseFloat(checkbox.getAttribute('data-id'));
        if (this.checked) {
          selectedRecordIds.add(recordId);
        } else {
          selectedRecordIds.delete(recordId);
        }
      });
      updateBatchControls();
      updateTableSelection();
    });
  }
  
  // 批量删除按钮事件
  if (batchDeleteBtn) {
    batchDeleteBtn.addEventListener('click', batchDeleteRecords);
  }
  
  // 取消选择按钮事件
  if (batchCancelBtn) {
    batchCancelBtn.addEventListener('click', cancelSelection);
  }
  
  console.log('批量选择功能初始化完成！');
}

/**
 * 更新批量操作控制栏的显示状态
 * 关键修复：使用 classList.toggle 而不是直接修改 style.display，
 * 避免触发 CSS 动画反复播放导致的布局抖动
 */
function updateBatchControls() {
  const batchControls = document.getElementById('batch-controls');
  const selectedCount = document.getElementById('selected-count');
  const selectAllCheckbox = document.getElementById('select-all-checkbox');
  
  if (!batchControls) return;
  
  // 使用类名切换显示状态，避免触发动画
  const isVisible = selectedRecordIds.size > 0;
  
  // 避免频繁的DOM操作：只有当状态确实改变时才更新
  const currentlyVisible = batchControls.classList.contains('visible');
  if (isVisible !== currentlyVisible) {
    batchControls.classList.toggle('visible', isVisible);
  }
  
  // 更新选中计数
  if (selectedCount) {
    selectedCount.textContent = `已选择 ${selectedRecordIds.size} 条记录`;
  }
  
  // 更新全选复选框状态
  const totalCheckboxes = document.querySelectorAll('.record-checkbox').length;
  if (selectAllCheckbox) {
    selectAllCheckbox.checked = selectedRecordIds.size === totalCheckboxes && totalCheckboxes > 0;
  }
}

/**
 * 更新表格中的选中状态（高亮选中的行）
 */
function updateTableSelection() {
  const rows = document.querySelectorAll('#history-table tr');
  rows.forEach(row => {
    const checkbox = row.querySelector('.record-checkbox');
    if (checkbox) {
      const recordId = parseFloat(checkbox.getAttribute('data-id'));
      if (selectedRecordIds.has(recordId)) {
        row.classList.add('selected');
      } else {
        row.classList.remove('selected');
      }
    }
  });
}

/**
 * 取消所有选择
 */
function cancelSelection() {
  selectedRecordIds.clear();
  const checkboxes = document.querySelectorAll('.record-checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.checked = false;
  });
  updateBatchControls();
  updateTableSelection();
}

/**
 * 批量删除选中的记录
 */
function batchDeleteRecords() {
  if (selectedRecordIds.size === 0) {
    showNotification('请先选择要删除的记录', 'warning');
    return;
  }
  
  const count = selectedRecordIds.size;
  const message = count === 1 
    ? '确定删除这 1 条记录吗？' 
    : `确定删除这 ${count} 条记录吗？`;
  
  if (!confirm(message)) {
    return;
  }
  
  // 保存到撤销栈
  const recordsToDelete = [];
  selectedRecordIds.forEach(id => {
    const record = materialRecords.find(r => r.id === id);
    if (record) {
      recordsToDelete.push({...record}); // 深拷贝
    }
  });
  
  // 最多保存10条撤销记录
  deletionUndoStack.push(...recordsToDelete);
  if (deletionUndoStack.length > 10) {
    deletionUndoStack = deletionUndoStack.slice(-10);
  }
  
  // 执行删除
  const originalLength = materialRecords.length;
  materialRecords = materialRecords.filter(r => !selectedRecordIds.has(r.id));
  const deletedCount = originalLength - materialRecords.length;
  
  if (deletedCount > 0) {
    // 保存数据
    save();
    
    // 清空选择
    cancelSelection();
    
    // 更新UI
    renderTable();
    updateStats();
    renderCharts();
    
    // 显示撤销提示
    showNotification(
      `已删除 ${deletedCount} 条记录 <button onclick="undoLastBatchDeletion()" class="undo-btn">撤销</button>`,
      'success',
      10000 // 10秒后消失
    );
    
    console.log(`批量删除完成：删除了 ${deletedCount} 条记录`);
  } else {
    showNotification('删除失败，未找到匹配的记录', 'error');
  }
}

/**
 * 撤销最后一次批量删除
 */
function undoLastBatchDeletion() {
  if (deletionUndoStack.length === 0) {
    showNotification('没有可撤销的删除操作', 'info');
    return;
  }
  
  // 获取最近一次批量删除的记录（栈中的最后N条）
  const lastBatchSize = Math.min(5, deletionUndoStack.length); // 假设最多一次删5条
  const recordsToRestore = deletionUndoStack.splice(-lastBatchSize, lastBatchSize);
  
  // 恢复记录
  let restoredCount = 0;
  recordsToRestore.forEach(deletedRecord => {
    // 检查是否已存在（可能被重新添加了）
    const exists = materialRecords.some(r => r.date === deletedRecord.date);
    if (!exists) {
      // 生成新的ID
      deletedRecord.id = Date.now() + Math.random();
      materialRecords.push(deletedRecord);
      restoredCount++;
    }
  });
  
  if (restoredCount > 0) {
    // 保存数据
    save();
    
    // 更新UI
    renderTable();
    updateStats();
    renderCharts();
    
    showNotification(`已撤销删除，成功恢复了 ${restoredCount} 条记录`, 'success');
    console.log(`撤销删除完成：恢复了 ${restoredCount} 条记录`);
  } else {
    showNotification('撤销失败，记录可能已被重新添加', 'warning');
  }
}

/**
 * 全选/取消全选功能
 */
window.toggleSelectAll = function(checked) {
  const checkboxes = document.querySelectorAll('.record-checkbox');
  
  // 一次性更新所有状态，避免重复操作
  checkboxes.forEach(checkbox => {
    checkbox.checked = checked;
    const recordId = parseFloat(checkbox.getAttribute('data-id'));
    if (checked) {
      selectedRecordIds.add(recordId);
    } else {
      selectedRecordIds.delete(recordId);
    }
  });
  
  // 只调用一次更新
  updateTableSelection();
  updateBatchControls();
};

/**
 * 处理单个记录的选择状态变化
 * 优化：避免不必要的 DOM 操作，减少浏览器重排
 */
function handleRecordSelection(checkbox) {
function handleRecordSelection（checkbox） {
  const recordId = parseFloat(checkbox.getAttribute('data-id'));
  
  if (checkbox.checked) {
    selectedRecordIds.add(recordId);
    // 直接更新表格行的选中状态
    checkbox.closest('tr').classList.add('selected');
  } else {
    selectedRecordIds.delete(recordId);
    checkbox.closest('tr').classList.remove('selected');
  }
  
  // 更新批量控制栏（只更新计数和全选状态）
  updateBatchControls();
  
  // 同步更新表头全选框状态（在 updateBatchControls 中处理）
}

// 在表格渲染完成后，更新批量控制栏和全选状态
const originalRenderTableForBatch = renderTable;
renderTable = function() {
  originalRenderTableForBatch();
  
  // 高亮已选中的行
  updateTableSelection();
  
  // 更新批量控制栏（已经包含全选状态）
  updateBatchControls();
};

// 初始化所有新功能
document.addEventListener('DOMContentLoaded', function() {
  // 稍延迟以确保 DOM 完全加载
  setTimeout(() => {
    initFAB();
    initKeyboardShortcuts();
    initFilters();
    enhanceCharts();
    initBatchInput();
    initExcelFeatures();
    initBatchSelection();
    console.log('新增 UI 功能初始化完成！');
  }, 100);
});
