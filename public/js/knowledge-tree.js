document.addEventListener('DOMContentLoaded', function() {
    const nodes = document.querySelectorAll('.knowledge-node');
    
    nodes.forEach(node => {
        const header = node.querySelector('.node-header');
        const toggle = node.querySelector('.node-toggle');
        
        header.addEventListener('click', function() {
            node.classList.toggle('expanded');
            
            // 添加展开动画
            if (node.classList.contains('expanded')) {
                toggle.textContent = '−';
                node.style.background = 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)';
            } else {
                toggle.textContent = '+';
                node.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            }
        });
    });
    
    // 添加连接线动画效果
    function createConnectionLines() {
        const container = document.querySelector('.tree-container');
        const nodes = container.querySelectorAll('.knowledge-node');
        
        // 简单的连接线逻辑，可以根据需要扩展
        nodes.forEach((node, index) => {
            if (index % 2 === 0 && nodes[index + 1]) {
                const line = document.createElement('div');
                line.className = 'connection-line';
                line.style.cssText = `
                    position: absolute;
                    width: 2px;
                    height: 50px;
                    background: #e2e8f0;
                    left: calc(50% - 1px);
                    top: ${node.offsetTop + node.offsetHeight}px;
                    z-index: -1;
                `;
                container.appendChild(line);
            }
        });
    }
    
    // 延迟执行以确保DOM完全加载
    setTimeout(createConnectionLines, 100);
});