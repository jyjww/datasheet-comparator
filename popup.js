let currentPage = 1; // 현재 페이지
const resultsPerPage = 3; // 페이지당 표시할 결과 개수
let allResults = []; // 전체 검색 결과 저장

import { getDocument, GlobalWorkerOptions } from './libs/pdf.mjs';

// PDF.js 워커 설정
GlobalWorkerOptions.workerSrc = './libs/pdf.worker.mjs';

// 제품 상세 정보 검색 함수 수정
async function searchProductDetails(partName) {
  try {
    const basePartName = partName.match(/^[A-Za-z]+\d+\./)?.[0] || partName;
    
    // URL 중복 제거 (co.kr 반복 문제 해결)
    const baseUrl = 'https://www.alldatasheet.co.kr';
    const response = await fetch(`${baseUrl}/view.jsp?Searchword=${encodeURIComponent(basePartName)}`);
    const htmlText = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');

    const rows = Array.from(doc.querySelectorAll('tr')).filter(row => {
      const partNameCell = row.querySelector('td a b');
      if (!partNameCell) return false;
      
      const rowPartName = partNameCell.textContent.trim().toLowerCase();
      const searchPartName = partName.toLowerCase();
      
      return rowPartName.includes(searchPartName) || 
             rowPartName.startsWith(basePartName.toLowerCase());
    });

    return rows.map(row => {
      const manufacturerImg = row.querySelector('td img[src*="company_logo"]');
      const partNameElement = row.querySelector('td a');
      const descriptionElement = row.querySelector('td:nth-child(4)');
      const pdfLinkElement = row.querySelector('a[href*="datasheet-pdf"]');

      // 제조사 정보 추출 개선
      let manufacturer = 'N/A';
      if (manufacturerImg) {
        const imgSrc = manufacturerImg.getAttribute('src');
        if (imgSrc.includes('ROHM')) manufacturer = 'ROHM';
        else if (imgSrc.includes('DIODES')) manufacturer = 'DIODES';
        else if (imgSrc.includes('KEC')) manufacturer = 'KEC';
      }

      // PDF URL에서 제조사 정보 추출 (제조사를 찾지 못한 경우)
      let pdfUrl = null;
      if (pdfLinkElement) {
        let href = pdfLinkElement.getAttribute('href');
        if (href) {
          // URL 중복 제거
          href = href.replace(/^\/\/www\.alldatasheet\.co\.kr\/\/www\.alldatasheet\.co\.kr/, '');
          href = href.replace(/^\/\/www\.alldatasheet\.co\.kr/, '');
          
          // 올바른 URL 형�으로 변환
          pdfUrl = href.startsWith('http') ? href : 
                  href.startsWith('/') ? `https://www.alldatasheet.co.kr${href}` :
                  `https://www.alldatasheet.co.kr/${href}`;
          
          // 여전히 중복된 도메인이 있는지 확인하고 수정
          pdfUrl = pdfUrl.replace(/https:\/\/www\.alldatasheet\.co\.kr\/\/www\.alldatasheet\.co\.kr/, 'https://www.alldatasheet.co.kr');
          
          // 제조사가 N/A인 경우 PDF URL에서 제조사 추출
          if (manufacturer === 'N/A') {
            const urlMatch = pdfUrl.match(/\/pdf\/\d+\/([^\/]+)\//);
            if (urlMatch && urlMatch[1]) {
              manufacturer = urlMatch[1].toUpperCase();
            }
          }
        }
      }

      let fullPartName = 'N/A';
      if (partNameElement) {
        const textNodes = Array.from(partNameElement.childNodes)
          .filter(node => node.nodeType === 3)
          .map(node => node.textContent.trim())
          .filter(text => text.length > 0);
        
        fullPartName = textNodes.join('').trim();
        const boldText = partNameElement.querySelector('b')?.textContent || '';
        if (boldText && !fullPartName.includes(boldText)) {
          fullPartName = boldText + fullPartName;
        }
      }

      return {
        manufacturer: manufacturer,
        partName: fullPartName,
        description: descriptionElement ? descriptionElement.textContent.trim() : 'N/A',
        pdfUrl: pdfUrl
      };
    });

  } catch (error) {
    console.error('데이터 검색 중 오류 발생:', error);
    return [];
  }
}

// 검색 버튼 클릭 이벤트 (수정된 버전)
document.querySelectorAll('.search-btn').forEach((button, index) => {
  button.addEventListener('click', async function () {
    const tabNumber = index + 1;
    const searchInput = document.querySelector(`#tab${tabNumber} .search-input`);
    const searchQuery = searchInput.value;

    if (!searchQuery) {
      alert('제품명을 입력하세요!');
      return;
    }

    try {
      // 검색어와 결과를 localStorage에 저장
      localStorage.setItem(`lastSearch${tabNumber}`, searchQuery);
      
      const results = await searchProductDetails(searchQuery);
      localStorage.setItem(`lastResults${tabNumber}`, JSON.stringify(results));
      localStorage.setItem(`lastPage${tabNumber}`, '1');
      
      // 현재 탭의 결과 표시
      displaySearchResults(results, tabNumber);
    } catch (error) {
      alert(`제품 정보를 가져올 수 없습니다. 오류: ${error.message}`);
    }
  });
});

// 페이지 로드 시 마지막 검색 결과 복원 (수정된 버전)
document.addEventListener('DOMContentLoaded', function() {
  // 각 탭의 마지막 검색 결과 복원
  for (let i = 1; i <= 3; i++) {
    const lastSearch = localStorage.getItem(`lastSearch${i}`);
    const lastResults = localStorage.getItem(`lastResults${i}`);
    
    if (lastSearch && lastResults) {
      const searchInput = document.querySelector(`#tab${i} .search-input`);
      searchInput.value = lastSearch;
      const results = JSON.parse(lastResults);
      displaySearchResults(results, i);
    }
  }
});

// 검색 결과 표시 함수 (수정된 버전)
function displaySearchResults(results, tabNumber) {
  const resultsContainer = document.querySelector(`#tab${tabNumber} .results-container`);
  resultsContainer.innerHTML = ''; // 기존 결과 초기화

  const startIndex = (currentPage - 1) * resultsPerPage;
  const endIndex = Math.min(startIndex + resultsPerPage, results.length);
  const resultsToShow = results.slice(startIndex, endIndex);

  resultsToShow.forEach(result => {
    const div = document.createElement('div');
    div.className = 'result-item';
    div.innerHTML = `
      <strong>${result.partName}</strong> - ${result.manufacturer}<br>
      <span>${result.description}</span>
    `;
    div.addEventListener('click', () => showProductDetails(result, tabNumber));
    resultsContainer.appendChild(div);
  });

  updatePaginationButtons(results.length, tabNumber);
}

// 페이지 이동 버튼 업데이트
function updatePaginationButtons(totalResults, tabNumber) {
  const paginationContainer = document.querySelector(`#tab${tabNumber} .pagination`);
  paginationContainer.innerHTML = '';

  const prevButton = document.createElement('button');
  prevButton.textContent = '<';
  prevButton.disabled = currentPage === 1;
  prevButton.addEventListener('click', () => {
    currentPage--;
    displaySearchResults(JSON.parse(localStorage.getItem(`lastResults${tabNumber}`)), tabNumber);
  });

  const nextButton = document.createElement('button');
  nextButton.textContent = '>';
  nextButton.disabled = currentPage * resultsPerPage >= totalResults;
  nextButton.addEventListener('click', () => {
    currentPage++;
    displaySearchResults(JSON.parse(localStorage.getItem(`lastResults${tabNumber}`)), tabNumber);
  });

  paginationContainer.appendChild(prevButton);
  paginationContainer.appendChild(nextButton);
}


// PDF URL을 가져오는 함수
async function getPdfUrl(partName) {
  try {
    const response = await fetch(`https://www.alldatasheet.co.kr/view.jsp?Searchword=${encodeURIComponent(partName)}`);
    const htmlText = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');
    
    // PDF 링크를 찾습니다
    const pdfLink = doc.querySelector('a[href*="datasheet-pdf/pdf"]');
    if (!pdfLink) return null;
    
    // URL에서 필요한 정보를 추출합니다
    const pdfUrl = pdfLink.href;
    const match = pdfUrl.match(/\/pdf\/(\d+)\/([^\/]+)\/([^\.]+)\.html/);
    if (!match) return null;
    
    // 바른 뷰어 URL을 생성합니다
    return `https://www.alldatasheet.co.kr/datasheet-pdf/view/${match[1]}/${match[2]}/${match[3]}.html`;
  } catch (error) {
    console.error('PDF URL 가져오기 실패:', error);
    return null;
  }
}

// 제품 상세 정보 표시 함수 수정
function showProductDetails(product, tabNumber) {
  const detailsContainer = document.querySelector(`#tab${tabNumber} .product-details`);
  
  // id 선택자로 변경
  const manufacturerElement = detailsContainer.querySelector('#manufacturer');
  const partNameElement = detailsContainer.querySelector('#partName');
  const descriptionElement = detailsContainer.querySelector('#description');
  const pdfLinkElement = detailsContainer.querySelector('#pdfLink');

  if (manufacturerElement) manufacturerElement.textContent = product.manufacturer;
  if (partNameElement) partNameElement.textContent = product.partName;
  if (descriptionElement) descriptionElement.textContent = product.description;
  
  if (pdfLinkElement) {
    pdfLinkElement.innerHTML = '';
    if (product.pdfUrl) {
      const pdfLink = document.createElement('a');
      pdfLink.href = product.pdfUrl;
      pdfLink.target = '_blank';
      pdfLink.textContent = 'Datasheet 바로가기';
      pdfLinkElement.appendChild(pdfLink);
    } else {
      pdfLinkElement.textContent = 'PDF 없음';
    }
  }
}

// 전환 기능
document.querySelectorAll('.tab-btn').forEach(button => {
  button.addEventListener('click', () => {
    // 모든 탭 버튼에서 active 클래스 제거
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // 모든 탭 컨텐츠에서 active 클래스 제거
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    
    // 클릭된 탭 버튼과 해당 컨텐츠에 active 클래스 추가
    button.classList.add('active');
    const tabId = button.getAttribute('data-tab');
    document.getElementById(tabId).classList.add('active');
  });
});

