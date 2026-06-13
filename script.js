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
  
  if (!data.stage) {
    errors.push('请选择阶段');
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
document.getElementById('parts-stage').addEventListener('change', function () {
  const partsInput = document.getElementById('parts');
  const expectationInput = document.getElementById('expectation-value');
  const isDouble = doublePartsCheck.checked;
  const expectationType = document.getElementById('expectation-type').value;
  
  if (STAGE_PARTS[this.value]) {
    partsInput.value = STAGE_PARTS[this.value];
    const dailyValue = getStageExpectation(this.value, isDouble);
    expectationInput.value = expectationType === 'monthly' ? (dailyValue * 30).toFixed(2) : dailyValue;
  } else {
    partsInput.value = 0;
  }
});

doublePartsCheck.addEventListener('change', function () {
  const stage = document.getElementById('parts-stage').value;
  const expectationInput = document.getElementById('expectation-value');
  const expectationType = document.getElementById('expectation-type').value;
  
  if (STAGE_EXPECTATIONS[stage]) {
    const dailyValue = getStageExpectation(stage, this.checked);
    expectationInput.value = expectationType === 'monthly' ? (dailyValue * 30).toFixed(2) : dailyValue;
  }
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
  
  console.log('5. 初始化默认阶段零件数量...');
  // 初始化默认阶段的零件数量
  const partsStage = document.getElementById('parts-stage');
  if (partsStage && partsStage.value) {
    const partsInput = document.getElementById('parts');
    const expectationInput = document.getElementById('expectation-value');
    const isDouble = doublePartsCheck.checked;
    const expectationType = document.getElementById('expectation-type').value;
    
    if (STAGE_PARTS[partsStage.value]) {
      partsInput.value = STAGE_PARTS[partsStage.value];
      const dailyValue = getStageExpectation(partsStage.value, isDouble);
      expectationInput.value = expectationType === 'monthly' ? (dailyValue * 30).toFixed(2) : dailyValue;
      console.log(`已自动填充 ${partsStage.value} 阶段的零件数量: ${STAGE_PARTS[partsStage.value]}`);
    }
  }
  
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
    const inputs = ['modules-1', 'modules-2', 'modules-3', 'parts', 'parts-stage'];
    
    inputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', updateRealTimeCalculation);
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
    let parts = +document.getElementById('parts').value || 0;
    const stage = document.getElementById('parts-stage').value;
    
    const isDouble = doublePartsCheck.checked;
    if (isDouble) parts *= 2;
    
    const totalModules = m1 + m2 + m3;
    const partsToMod = (parts / 100).toFixed(2);
    const totalProduction = (totalModules + parseFloat(partsToMod)).toFixed(2);
    
    // 智能计算期望差值
    let expectedForCurrentDay = expectations.daily; // 默认使用每日设置的期望值
    
    // 如果选择了阶段，使用阶段特定的期望值
    if (stage === '5') {
        expectedForCurrentDay = isDouble ? 3.32 : 1.66;
    } else if (stage === '6') {
        expectedForCurrentDay = isDouble ? 4.31 : 2.15;
    } else if (stage === '7') {
        expectedForCurrentDay = isDouble ? 4.56 : 2.28;
    }
    
    // 差值计算应该只基于模组数量，不包括零件产出
    const difference = (totalModules - expectedForCurrentDay).toFixed(2);
    
    // 更新显示
    realtimeProductionEl.textContent = totalProduction;
    realtimeDifferenceEl.textContent = difference;
    realtimeDifferenceEl.className = `realtime-value ${parseFloat(difference) >= 0 ? 'difference-positive' : 'difference-negative'}`;
    
    console.log(`实时预览 - 模组=${totalModules}, 零件=${parts}, 零件换算=${partsToMod}, 总产出=${totalProduction}, 期望=${expectedForCurrentDay}, 差值=${difference} (${totalModules} - ${expectedForCurrentDay})`);
    
    // 添加视觉反馈
    const realtimeItems = document.querySelectorAll('.stats-item.real-time-calc');
    realtimeItems.forEach(item => {
        item.classList.add('highlight');
        setTimeout(() => item.classList.remove('highlight'), 300);
    });
}

// 日期导航功能
function setupDateNavigation() {
    const dateInput = document.getElementById('record-date');
    const prevBtn = document.getElementById('prev-day');
    const nextBtn = document.getElementById('next-day');
    
    prevBtn.addEventListener('click', () => {
        const currentDate = new Date(dateInput.value);
        currentDate.setDate(currentDate.getDate() - 1);
        dateInput.valueAsDate = currentDate;
    });
    
    nextBtn.addEventListener('click', () => {
        const currentDate = new Date(dateInput.value);
        currentDate.setDate(currentDate.getDate() + 1);
        // 不能选择未来日期
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (currentDate <= today) {
            dateInput.valueAsDate = currentDate;
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
  const headers = ['日期', '阶段', '第一次', '第二次', '第三次', '零件', '模组总数', '零件换算', '总产出', '期望', '差值'];
  const csvContent = [
    headers.join(','),
    ...records.map(r => [
      r.date,
      r.stage || '-',
      r.m1,
      r.m2,
      r.m3,
      r.parts,
      r.totalModules,
      r.partsToMod,
      r.totalProduction,
      r.stageExpectation || '-',
      r.diff
    ].join(','))
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

// 显示通知
function showNotification(message, type = 'info') {
    // 移除现有的通知
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
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
        backgroundColor: type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'
    });
    
    document.body.appendChild(notification);
    
    // 显示动画
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // 自动隐藏
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
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
  let parts = +document.getElementById('parts').value || 0;
  const stage = document.getElementById('parts-stage').value;

  // 输入验证
  const validationResult = validateRecord({ date, m1, m2, m3, parts, stage });
  if (!validationResult.isValid) {
    showNotification(validationResult.errors.join('; '), 'error');
    return;
  }

  const isDouble = doublePartsCheck.checked;
  const finalParts = isDouble ? parts * 2 : parts;

  const totalModules = m1 + m2 + m3;
  const partsToMod = (finalParts / 100).toFixed(2);
  const totalProduction = (totalModules + parseFloat(partsToMod)).toFixed(2);
  
  // 根据阶段计算期望产出
  let stageExpectation = getStageExpectation(stage, isDouble);
  const diff = (totalModules - stageExpectation).toFixed(2);
  
  console.log(`记录处理 - 日期:${date}, 阶段:${stage}, 模组:${totalModules}, 零件:${finalParts}, 差值:${diff}`);

  if (isEditing && editingId) {
    // 更新现有记录
    const index = materialRecords.findIndex(r => r.id === editingId);
    if (index !== -1) {
      materialRecords[index] = {
        ...materialRecords[index],
        date, m1, m2, m3, parts: finalParts, stage, isDouble,
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
      id: Date.now(), date, m1, m2, m3, parts: finalParts, stage, isDouble,
      totalModules, partsToMod, totalProduction, diff, stageExpectation
    });
    
    showNotification('记录添加成功！', 'success');
    materialForm.reset();
    doublePartsCheck.checked = false;
    document.getElementById('record-date').valueAsDate = new Date();
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
  document.getElementById('parts-stage').value = record.stage;
  document.getElementById('parts').value = record.parts / (record.isDouble ? 2 : 1);
  document.getElementById('double-parts-check').checked = record.isDouble;
  
  const submitBtn = document.querySelector('.submit-btn');
  submitBtn.textContent = '更新记录';
  
  document.getElementById('record-date').focus();
  showNotification('已加载记录到表单，修改后点击更新', 'info');
}

function resetForm() {
  isEditing = false;
  editingId = null;
  
  materialForm.reset();
  doublePartsCheck.checked = false;
  document.getElementById('record-date').valueAsDate = new Date();
  
  const submitBtn = document.querySelector('.submit-btn');
  submitBtn.textContent = '提交记录';
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
      <th>第一次</th>
      <th>第二次</th>
      <th>第三次</th>
      <th>零件</th>
      <th>期望产出</th>
      <th>模组总数</th>
      <th>零件换算</th>
      <th>总产出</th>
      <th>差值</th>
      <th>操作</th>
    `;
  }

  list.forEach(item => {
    const recalculatedPartsToMod = (item.parts / 100).toFixed(2);
    const recalculatedProduction = (item.totalModules + parseFloat(recalculatedPartsToMod)).toFixed(2);
    
    let expectedValue = item.stageExpectation || 0;
    
    if (!expectedValue && item.stage && STAGE_EXPECTATIONS[item.stage]) {
      expectedValue = item.isDouble ? 
        STAGE_EXPECTATIONS[item.stage].double : 
        STAGE_EXPECTATIONS[item.stage].normal;
    }
    
    if (!expectedValue) {
      expectedValue = expectations.daily || 2.15;
    }
    
    const recalculatedDiff = (item.totalModules - expectedValue).toFixed(2);
    
    const tr = document.createElement('tr');
    
    // 安全创建单元格，防止 XSS
    const tdDate = document.createElement('td');
    tdDate.textContent = item.date;
    
    const tdStage = document.createElement('td');
    tdStage.textContent = item.stage || '-';
    
    const tdM1 = document.createElement('td');
    tdM1.textContent = item.m1;
    
    const tdM2 = document.createElement('td');
    tdM2.textContent = item.m2;
    
    const tdM3 = document.createElement('td');
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
    tdStageExpectation.textContent = item.stageExpectation || '-';
    
    const tdTotalModules = document.createElement('td');
    tdTotalModules.textContent = item.totalModules;
    
    const tdPartsToMod = document.createElement('td');
    tdPartsToMod.textContent = recalculatedPartsToMod;
    
    const tdProduction = document.createElement('td');
    tdProduction.className = 'production-value';
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
            // 优先使用记录自身保存的stageExpectation
            let recordExpectation = 0;
            if (record.stageExpectation !== undefined && record.stageExpectation !== null) {
                recordExpectation = record.stageExpectation;
            } else if (record.stage) {
                // 如果记录中没有保存，但有阶段信息，根据阶段和双倍状态重新计算
                if (record.stage === '5') {
                    recordExpectation = record.isDouble ? 3.32 : 1.66;
                } else if (record.stage === '6') {
                    recordExpectation = record.isDouble ? 4.31 : 2.15;
                } else if (record.stage === '7') {
                    recordExpectation = record.isDouble ? 4.56 : 2.28;
                }
            } else {
                // 如果以上都没有，使用记录创建时的日期望（这里无法获取，所以使用阶段默认值）
                recordExpectation = 2.15; // 默认使用6阶段普通日的期望值
            }
            monthExpected += recordExpectation;
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
            const recordExpectation = i.stageExpectation || expectations.daily;
            expectTotal += recordExpectation;
            console.log(`  - ${i.date}: 期望=${recordExpectation} (阶段=${i.stage}, 双倍=${i.isDouble})`);
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
                // 优先使用记录自身保存的stageExpectation
                let recordExpectation = 0;
                if (record.stageExpectation !== undefined && record.stageExpectation !== null) {
                    recordExpectation = record.stageExpectation;
                } else if (record.stage) {
                    // 如果记录中没有保存，但有阶段信息，根据阶段和双倍状态重新计算
                    if (record.stage === '5') {
                        recordExpectation = record.isDouble ? 3.32 : 1.66;
                    } else if (record.stage === '6') {
                        recordExpectation = record.isDouble ? 4.31 : 2.15;
                    } else if (record.stage === '7') {
                        recordExpectation = record.isDouble ? 4.56 : 2.28;
                    }
                } else {
                    // 如果以上都没有，使用记录创建时的日期望（这里无法获取，所以使用阶段默认值）
                    recordExpectation = 2.15; // 默认使用6阶段普通日的期望值
                }
                monthExpected += recordExpectation;
            });
            
            console.log(`月度统计 - ${month.monthName}:`);
            console.log(`  - 使用每条记录自身保存的期望计算`);
            console.log(`  - 期望产出: ${monthExpected.toFixed(2)} (各记录期望产出之和)`);
            console.log(`  - 详细记录:`);
            month.records.forEach(record => {
                let recordExpectation = record.stageExpectation || '未知';
                console.log(`    - ${record.date}: 期望=${recordExpectation} (阶段=${record.stage}, 双倍=${record.isDouble})`);
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
    const expectationData = sortedRecords.map(r => r.stageExpectation || expectations.daily);
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
    
    // 按阶段统计
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
                    text: '各阶段产出分布'
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
    
    // 阶段筛选
    if (filterState.stage && record.stage !== filterState.stage) {
      return false;
    }
    
    // 搜索筛选
    if (filterState.search) {
      const searchTerm = filterState.search.toLowerCase();
      if (!record.date.toLowerCase().includes(searchTerm) && 
          !record.stage.toLowerCase().includes(searchTerm) &&
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
      <th>日期</th>
      <th class="mobile-hide">第一次</th>
      <th class="mobile-hide">第二次</th>
      <th class="mobile-hide">第三次</th>
      <th>零件</th>
      <th>阶段</th>
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
    
    let expectedValue = item.stageExpectation || 0;
    
    if (!expectedValue && item.stage && STAGE_EXPECTATIONS[item.stage]) {
      expectedValue = item.isDouble ? 
        STAGE_EXPECTATIONS[item.stage].double : 
        STAGE_EXPECTATIONS[item.stage].normal;
    }
    
    if (!expectedValue) {
      expectedValue = expectations.daily || 2.15;
    }
    
    const recalculatedDiff = (item.totalModules - expectedValue).toFixed(2);
    
    const tr = document.createElement('tr');
    
    const tdDate = document.createElement('td');
    tdDate.textContent = item.date;
    
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
    
    const tdStage = document.createElement('td');
    tdStage.textContent = item.stage || '-';
    
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
    tr.appendChild(tdM1);
    tr.appendChild(tdM2);
    tr.appendChild(tdM3);
    tr.appendChild(tdParts);
    tr.appendChild(tdStage);
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
    const expectationData = sortedRecords.map(r => r.stageExpectation || expectations.daily);
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

  // 初始化日期默认值
  const today = new Date();
  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const batchStartDate = document.getElementById('batch-start-date');
  const batchEndDate = document.getElementById('batch-end-date');
  
  if (batchStartDate) {
    batchStartDate.value = formatDate(lastWeek);
  }
  if (batchEndDate) {
    batchEndDate.value = formatDate(today);
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

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

  const startDate = new Date(startDateInput.value);
  const endDate = new Date(endDateInput.value);

  if (startDate > endDate) {
    showNotification('起始日期不能晚于结束日期', 'error');
    return;
  }

  // 生成日期范围内的所有行
  batchRows = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const dateStr = formatDate(currentDate);
    
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
    } else {
      console.log(`日期 ${dateStr} 已有记录，跳过`);
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
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

// 初始化所有新功能
document.addEventListener('DOMContentLoaded', function() {
  // 稍延迟以确保 DOM 完全加载
  setTimeout(() => {
    initFAB();
    initKeyboardShortcuts();
    initFilters();
    enhanceCharts();
    initBatchInput();
    console.log('新增 UI 功能初始化完成！');
  }, 100);
});
