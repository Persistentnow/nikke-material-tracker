let materialRecords = [];
let expectations = { daily: 0, monthly: 0 };
let currentStatsView = 'daily';
let currentSortBy = 'date';

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

// 阶段选择自动填零件数量和期望产出
document.getElementById('parts-stage').addEventListener('change', function () {
    const partsInput = document.getElementById('parts');
    const expectationInput = document.getElementById('expectation-value');
    const isDouble = doublePartsCheck.checked;
    const expectationType = document.getElementById('expectation-type').value;
    
    switch (this.value) {
        case '5': 
            partsInput.value = 81; 
            const dailyValue5 = isDouble ? 3.32 : 1.66;
            expectationInput.value = expectationType === 'monthly' ? (dailyValue5 * 30).toFixed(2) : dailyValue5;
            break;
        case '6': 
            partsInput.value = 105;
            const dailyValue6 = isDouble ? 4.31 : 2.15;
            expectationInput.value = expectationType === 'monthly' ? (dailyValue6 * 30).toFixed(2) : dailyValue6;
            break;
        case '7': 
            partsInput.value = 111;
            const dailyValue7 = isDouble ? 4.56 : 2.28;
            expectationInput.value = expectationType === 'monthly' ? (dailyValue7 * 30).toFixed(2) : dailyValue7;
            break;
        default: 
            partsInput.value = 0;
    }
});

// 双倍产出勾选时更新期望值
doublePartsCheck.addEventListener('change', function () {
    const stage = document.getElementById('parts-stage').value;
    const expectationInput = document.getElementById('expectation-value');
    const expectationType = document.getElementById('expectation-type').value;
    
    if (stage === '5') {
        const dailyValue = this.checked ? 3.32 : 1.66;
        expectationInput.value = expectationType === 'monthly' ? (dailyValue * 30).toFixed(2) : dailyValue;
    } else if (stage === '6') {
        const dailyValue = this.checked ? 4.31 : 2.15;
        expectationInput.value = expectationType === 'monthly' ? (dailyValue * 30).toFixed(2) : dailyValue;
    } else if (stage === '7') {
        const dailyValue = this.checked ? 4.56 : 2.28;
        expectationInput.value = expectationType === 'monthly' ? (dailyValue * 30).toFixed(2) : dailyValue;
    }
});

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('record-date').valueAsDate = new Date();
    loadData();
    renderTable();
    updateStats();
    bindEvents();
    setupRealTimeCalculation();
    setupDateNavigation();
    setupImportExport();
    
    // 初始化高级设置面板显示状态
    const expectationType = document.getElementById('expectation-type');
    const advancedMonthly = document.querySelector('.advanced-monthly');
    if (expectationType.value === 'monthly') {
        advancedMonthly.style.display = 'block';
    } else {
        advancedMonthly.style.display = 'none';
    }
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
            
            console.log('计算参数:', {doubleDays, normalDays, stage});
            
            // 根据阶段获取日期望
            let normalDaily, doubleDaily;
            if (stage === '5') {
                normalDaily = 1.66;
                doubleDaily = 3.32;
                console.log('使用5阶段预设值:', {normalDaily, doubleDaily});
            } else if (stage === '6') {
                normalDaily = 2.15;
                doubleDaily = 4.31;
                console.log('使用6阶段预设值:', {normalDaily, doubleDaily});
            } else if (stage === '7') {
                normalDaily = 2.28;
                doubleDaily = 4.56;
                console.log('使用7阶段预设值:', {normalDaily, doubleDaily});
            } else {
                // 默认情况
                normalDaily = expectations.daily || 1.66; // 使用5阶段的期望值作为默认值
                doubleDaily = normalDaily * 2;
                console.log('使用默认设置，日期望值:', {normalDaily, doubleDaily});
            }
            
            console.log('日期望值:', {normalDaily, doubleDaily});
            
            // 计算月期望
            const monthlyExpectation = (normalDaily * normalDays) + (doubleDaily * doubleDays);
            expectationInput.value = monthlyExpectation.toFixed(2);
            
            console.log('计算结果:', monthlyExpectation.toFixed(2));
            
            // 显示计算结果提示
            this.textContent = '计算完成!';
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
    
    const difference = (parseFloat(totalProduction) - expectedForCurrentDay).toFixed(2);
    
    // 更新显示
    realtimeProductionEl.textContent = totalProduction;
    realtimeDifferenceEl.textContent = difference;
    realtimeDifferenceEl.className = `stats-value ${parseFloat(difference) >= 0 ? 'difference-positive' : 'difference-negative'}`;
    
    console.log(`实时预览 - 模组=${totalModules}, 零件=${parts}, 零件换算=${partsToMod}, 总产出=${totalProduction}, 期望=${expectedForCurrentDay}, 差值=${difference}`);
    
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

// 导入导出功能
function setupImportExport() {
    const exportBtn = document.getElementById('export-data');
    const importBtn = document.getElementById('import-data');
    const fileInput = document.getElementById('file-input');

    // 导出数据
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const data = {
                records: materialRecords,
                expectations: expectations,
                exportDate: new Date().toISOString(),
                version: '1.0.0'
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
            
            // 显示成功提示
            showNotification('数据导出成功！', 'success');
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
                    
                    // 验证数据格式
                    if (!data.records || !Array.isArray(data.records)) {
                        throw new Error('无效的数据格式');
                    }
                    
                    // 备份当前数据
                    const backupRecords = [...materialRecords];
                    const backupExpectations = { ...expectations };
                    
                    // 导入数据
                    materialRecords = data.records;
                    if (data.expectations) {
                        expectations = data.expectations;
                    }
                    
                    // 保存并更新UI
                    save();
                    renderTable();
                    updateStats();
                    
                    // 更新期望设置界面
                    document.getElementById('expectation-value').value = currentStatsView === 'daily' ? 
                        expectations.daily : expectations.monthly;
                    
                    showNotification('数据导入成功！', 'success');
                    
                } catch (error) {
                    console.error('导入失败:', error);
                    showNotification('数据导入失败，请检查文件格式！', 'error');
                }
            };
            
            reader.readAsText(file);
            e.target.value = ''; // 重置文件输入
        });
    }
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

// 读取本地数据
function loadData() {
    materialRecords = JSON.parse(localStorage.getItem('nikkeRecords')) || [];
    expectations = JSON.parse(localStorage.getItem('nikkeExpect')) || { daily: 0, monthly: 0 };
    document.getElementById('expectation-value').value = expectations.daily;
}

// 保存数据
function save() {
    localStorage.setItem('nikkeRecords', JSON.stringify(materialRecords));
    localStorage.setItem('nikkeExpect', JSON.stringify(expectations));
}

// 提交记录
materialForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const date = document.getElementById('record-date').value;
    const m1 = +document.getElementById('modules-1').value || 0;
    const m2 = +document.getElementById('modules-2').value || 0;
    const m3 = +document.getElementById('modules-3').value || 0;
    let parts = +document.getElementById('parts').value || 0;
    const stage = document.getElementById('parts-stage').value;

    // 仅勾选时零件翻倍，模组不翻倍
    const isDouble = doublePartsCheck.checked;
    if (isDouble) parts *= 2;

    const totalModules = m1 + m2 + m3;
    const partsToMod = (parts / 100).toFixed(2);
    const totalProduction = (totalModules + parseFloat(partsToMod)).toFixed(2);
    
    // 根据阶段计算期望产出
    let stageExpectation = expectations.daily; // 默认使用每日设置的期望值
    
    if (stage === '5') {
        stageExpectation = isDouble ? 3.32 : 1.66;
        console.log('记录5阶段数据，使用5阶段期望值:', stageExpectation);
    } else if (stage === '6') {
        stageExpectation = isDouble ? 4.31 : 2.15;
    } else if (stage === '7') {
        stageExpectation = isDouble ? 4.56 : 2.28;
    }
    
    const diff = (parseFloat(totalProduction) - stageExpectation).toFixed(2);

    // 同日防重复
    if (materialRecords.some(i => i.date === date)) {
        alert('该日期已存在记录');
        return;
    }

    materialRecords.push({
        id: Date.now(), date, m1, m2, m3, parts, stage, isDouble,
        totalModules, partsToMod, totalProduction, diff, stageExpectation
    });

    save();
    materialForm.reset();
    doublePartsCheck.checked = false;
    document.getElementById('record-date').valueAsDate = new Date();
    renderTable();
    updateStats();
});

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

    // 更新表头
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
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.date}</td>
            <td>${item.stage || '-'}</td>
            <td>${item.m1}</td>
            <td>${item.m2}</td>
            <td>${item.m3}</td>
            <td>${item.parts} ${item.isDouble ? '<span class="double-badge">X2</span>' : ''}</td>
            <td>${item.stageExpectation || '-'}</td>
            <td>${item.totalModules}</td>
            <td>${item.partsToMod}</td>
            <td class="production-value">${item.totalProduction}</td>
            <td class="${item.diff >= 0 ? 'difference-positive' : 'difference-negative'}">${item.diff}</td>
            <td><button class="delete-btn" onclick="del(${item.id})">删除</button></td>
        `;
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
        const monthExpected = expectations.monthly > 0 ? (expectations.monthly / month.daysInMonth * month.days).toFixed(2) : (expectations.daily * month.days).toFixed(2);
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
        const expectTotal = expectations.daily * materialRecords.length;
        const diffTotal = totalMod - expectTotal;
        const diffTotalWithParts = totalProd - expectTotal;

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
            
            // 根据月度期望值和实际记录天数计算期望产出
            // 计算方式：(月度期望值 / 当月总天数) * 实际记录天数
            if (expectations.monthly > 0) {
                const dailyExpectation = expectations.monthly / month.daysInMonth;
                const monthExpected = dailyExpectation * month.days;
                totalExpected += monthExpected;
                console.log(`月度统计 - ${month.monthName}: 月度期望=${expectations.monthly}, 当月天数=${month.daysInMonth}, 记录天数=${month.days}, 期望产出=${monthExpected.toFixed(2)}`);
            } else {
                // 如果没有设置月度期望值，使用每日期望值计算
                const monthExpected = expectations.daily * month.days;
                totalExpected += monthExpected;
                console.log(`月度统计 - ${month.monthName}: 使用日期望=${expectations.daily}, 记录天数=${month.days}, 期望产出=${monthExpected.toFixed(2)}`);
            }
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
