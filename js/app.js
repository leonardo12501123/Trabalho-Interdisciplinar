
const $ = (s, scope = document) => scope.querySelector(s);
const $$ = (s, scope = document) => [...scope.querySelectorAll(s)];
const BRL = n => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const currentUser = () => {
    try {
        return JSON.parse(localStorage.getItem('letleo_session')) ?? null;
    } catch {
        return null;
    }
};

const getCart = () => {
    try {
        return JSON.parse(localStorage.getItem('letleo_cart')) ?? [];
    } catch {
        return [];
    }
};

const putCart = (cart) => localStorage.setItem('letleo_cart', JSON.stringify(cart));

const escapeHTML = str => String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
}[c]));

let toastTimeout;
function toast(message) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => el.classList.remove('show'), 3200);
}

function updateCartCount() {
    const el = $('#cartCount');
    if (el) el.textContent = getCart().reduce((n, i) => n + i.qtd, 0);
}

function card(p) {
    const imagemPadrao = p.categoria === 'Doces' ? 'pizza_doce.png' : 'pizza_calabresa.png';
    const imgUrl = p.imagem ? p.imagem : `img/${imagemPadrao}`;

    return `<article class="product-card">
        <a href="produto.html?id=${p.id}"><img loading="lazy" src="${escapeHTML(imgUrl)}" alt="${escapeHTML(p.nome)}"></a>
        <div class="card-body">
            <a href="produto.html?id=${p.id}"><h3>${escapeHTML(p.nome)}</h3></a>
            <p>${escapeHTML(p.descricao || '')}</p>
            <div class="card-bottom">
                <strong class="price">${BRL(p.preco)}</strong>
                <button class="add-button" 
                        data-add="${p.id}" 
                        data-nome="${escapeHTML(p.nome)}" 
                        data-preco="${p.preco}" 
                        data-imagem="${escapeHTML(imgUrl)}" 
                        aria-label="Adicionar ${escapeHTML(p.nome)} ao carrinho">+</button>
            </div>
        </div>
    </article>`;
}

function addToCart(produto, qtd = 1, tamanho = 'G') {
    const items = getCart();
    const existing = items.find(i => i.id === produto.id);
    if (existing) {
        existing.qtd += qtd;
    } else {
        items.push({
            id: produto.id,
            nome: produto.nome,
            preco: produto.preco,
            imagem: produto.imagem,
            qtd,
            tamanho
        });
    }
    putCart(items);
    updateCartCount();
    toast(`${produto.nome} adicionado ao carrinho!`);
}


async function renderFeatured() {
    const el = $('#featuredGrid');
    if (!el) return;
    try {
        const produtos = await apiFetch('/produtos');
        el.innerHTML = produtos.slice(0, 3).map(card).join('');
    } catch (err) {
        el.innerHTML = '<p class="empty-state">Erro ao carregar os produtos em destaque.</p>';
    }
}

async function initCatalog() {
    const grid = $('#productGrid');
    if (!grid) return;
    const search = $('#searchInput'), sort = $('#sortSelect'), chips = $('#categoryChips');
    let category = new URLSearchParams(location.search).get('categoria') || 'Todos';
    const cats = ['Todos', 'Pizzas', 'Doces', 'Especiais', 'Bebidas', 'Combos'];

    let todosProdutos = [];
    try {
        todosProdutos = await apiFetch('/produtos');
    } catch (err) {
        grid.innerHTML = '<p class="empty-state">Erro ao conectar com o servidor para obter o cardápio.</p>';
        return;
    }

    function render() {
        chips.innerHTML = cats.map(c => `<button class="chip ${c === category ? 'active' : ''}" data-category="${c}">${c}</button>`).join('');
        const q = search.value.trim().toLocaleLowerCase('pt-BR');
        let arr = todosProdutos.filter(p => (category === 'Todos' || p.categoria === category) && (p.nome + ' ' + (p.descricao || '')).toLocaleLowerCase('pt-BR').includes(q));

        if (sort.value === 'priceAsc') arr.sort((a, b) => a.preco - b.preco);
        else if (sort.value === 'priceDesc') arr.sort((a, b) => b.preco - a.preco);
        else if (sort.value === 'name') arr.sort((a, b) => a.nome.localeCompare(b.nome));

        grid.innerHTML = arr.map(card).join('');
        $('#emptyProducts').hidden = arr.length > 0;
    }

    chips.addEventListener('click', e => {
        const b = e.target.closest('[data-category]');
        if (b) {
            category = b.dataset.category;
            render();
        }
    });

    search.addEventListener('input', render);
    sort.addEventListener('change', render);
    render();
}

async function initProduct() {
    const el = $('#productDetail');
    if (!el) return;
    const id = new URLSearchParams(location.search).get('id');
    if (!id) return;

    try {
        const p = await apiFetch(`/produtos/${id}`);
        let qty = 1;
        const imgUrl = p.imagem ? p.imagem : 'img/pizza_calabresa.png';

        el.innerHTML = `<img src="${escapeHTML(imgUrl)}" alt="${escapeHTML(p.nome)}">
        <div>
            <span class="eyebrow">${escapeHTML(p.categoria)}</span>
            <h1>${escapeHTML(p.nome)}</h1>
            <p>${escapeHTML(p.descricao || '')}</p>
            <strong id="detailPrice" class="price">${BRL(p.preco)}</strong>
            <div class="option-row">
                <strong>Quantidade</strong>
                <div class="qty-controls">
                    <button data-qty="-1">−</button>
                    <b id="detailQty">1</b>
                    <button data-qty="1">+</button>
                </div>
            </div>
            <button class="button button-primary" id="detailAdd">Adicionar ao carrinho →</button>
            <p style="margin-top:22px">✦ Ingredientes selecionados &nbsp; ♨️ Massa artesanal</p>
        </div>`;

        el.addEventListener('click', e => {
            const q = e.target.closest('[data-qty]');
            if (q) {
                qty = Math.max(1, Math.min(50, qty + Number(q.dataset.qty)));
                $('#detailQty').textContent = qty;
            }
            if (e.target.closest('#detailAdd')) {
                addToCart({ id: p.id, nome: p.nome, preco: p.preco, imagem: imgUrl }, qty);
            }
        });
    } catch (err) {
        el.innerHTML = '<p class="empty-state">Produto não encontrado. <a href="cardapio.html">Ver cardápio</a></p>';
    }
}

function initCart() {
    const el = $('#cartItems'), sum = $('#cartSummary');
    if (!el || !sum) return;

    function render() {
        const items = getCart();
        if (!items.length) {
            el.innerHTML = '<div class="empty-state"><h3>Seu carrinho está vazio</h3><p>Escolha uma pizza para começar!</p><a class="button button-primary" href="cardapio.html">Explorar cardápio</a></div>';
            sum.innerHTML = '<h3>Resumo do pedido</h3><p>Adicione produtos para visualizar o total.</p>';
            return;
        }

        el.innerHTML = items.map(i => `<div class="cart-item">
            <img src="${escapeHTML(i.imagem)}" alt="${escapeHTML(i.nome)}">
            <div>
                <h3>${escapeHTML(i.nome)}</h3>
                <p>${BRL(i.preco)} cada</p>
            </div>
            <div class="cart-item-actions">
                <div class="qty-controls">
                    <button data-change="-1" data-id="${i.id}">−</button>
                    <strong>${i.qtd}</strong>
                    <button data-change="1" data-id="${i.id}">+</button>
                </div>
                <strong>${BRL(i.preco * i.qtd)}</strong>
                <button class="delete-button" data-remove="${i.id}">Remover</button>
            </div>
        </div>`).join('');

        const total = items.reduce((n, i) => n + (i.preco * i.qtd), 0);
        sum.innerHTML = `<h3>Resumo do pedido</h3>
            <div class="summary-row total"><span>Total</span><strong>${BRL(total)}</strong></div>
            <button id="checkoutButton" class="button button-primary full">Finalizar pedido →</button>`;
    }

    el.addEventListener('click', e => {
        const b = e.target.closest('[data-change],[data-remove]');
        if (!b) return;
        let items = getCart();
        const i = items.findIndex(x => x.id === Number(b.dataset.id));
        if (i < 0) return;

        if (b.hasAttribute('data-remove')) {
            items.splice(i, 1);
        } else {
            items[i].qtd += Number(b.dataset.change);
            if (items[i].qtd <= 0) items.splice(i, 1);
        }
        putCart(items);
        updateCartCount();
        render();
    });

    sum.addEventListener('click', async e => {
        if (!e.target.closest('#checkoutButton')) return;

        const user = currentUser();
        if (!user || !user.token) {
            toast('Entre na sua conta para finalizar o pedido.');
            setTimeout(() => location.href = 'login.html?retorno=carrinho.html', 700);
            return;
        }

        const items = getCart();
        if (!items.length) return;

        
        const payload = {
            itens: items.map(i => ({
                produtoId: i.id,
                quantidade: i.qtd
            }))
        };

        try {
            await apiFetch('/pedidos', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            putCart([]);
            updateCartCount();
            toast('Pedido realizado com sucesso!');
            setTimeout(() => location.href = 'pedidos.html', 800);
        } catch (err) {
            toast('Erro ao processar o pedido: ' + err.message);
        }
    });

    render();
}

async function initOrders() {
    const el = $('#ordersList');
    if (!el) return;

    const user = currentUser();
    if (!user || !user.token) {
        el.innerHTML = '<div class="empty-state">Entre na sua conta para consultar seus pedidos. <a href="login.html">Fazer login</a></div>';
        return;
    }

    try {
        const pedidos = await apiFetch('/meus-pedidos');
        if (!pedidos || !pedidos.length) {
            el.innerHTML = '<div class="empty-state">Nenhum pedido encontrado. <a href="cardapio.html">Escolher uma pizza</a></div>';
            return;
        }

        el.innerHTML = pedidos.map(o => {
            const dataStr = o.criado_em ? new Date(o.criado_em).toLocaleString('pt-BR') : 'Recente';
            const itensTexto = (o.itens || []).map(i => `${i.quantidade}× ${escapeHTML(i.nome || 'Produto')}`).join(', ');

            return `<article class="order-card">
                <div>
                    <h3>Pedido #${String(o.id).padStart(4, '0')}</h3>
                    <p>${dataStr} · ${itensTexto}</p>
                </div>
                <span class="status ${o.status === 'concluido' ? 'done' : o.status === 'cancelado' ? 'cancelled' : ''}">${escapeHTML(o.status)}</span>
                <strong class="price">${BRL(o.total)}</strong>
            </article>`;
        }).join('');
    } catch (err) {
        el.innerHTML = '<p class="empty-state">Erro ao buscar seus pedidos no servidor.</p>';
    }
}



function digits(s) { return String(s || '').replace(/\D/g, ''); }

function maskCPF(s) {
    const d = digits(s).slice(0, 11);
    return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2');
}

function maskPhone(s) {
    const d = digits(s).slice(0, 11);
    if (d.length <= 2) return d ? `(${d}` : '';
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function initMasks() {
    document.addEventListener('input', e => {
        const mask = e.target.dataset?.mask;
        if (mask === 'cpf') e.target.value = maskCPF(e.target.value);
        if (mask === 'phone') e.target.value = maskPhone(e.target.value);
    });
}

function initAuth() {
    const reg = $('#registerForm');
    if (reg) {
        reg.addEventListener('submit', async e => {
            e.preventDefault();
            const f = new FormData(reg);
            const nome = String(f.get('nome')).trim();
            const email = String(f.get('email')).trim().toLowerCase();
            const telefone = digits(f.get('telefone'));
            const senha = String(f.get('senha'));

            if (senha !== f.get('confirmar')) {
                toast('As senhas não coincidem.');
                return;
            }

           
            const payload = {
                nome,
                email,
                telefone,
                endereco: 'Endereço não informado', 
                senha
            };

            try {
              
                const response = await apiFetch('/cadastro', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });

                localStorage.setItem('letleo_session', JSON.stringify({
                    token: response.token,
                    cliente: response.cliente
                }));

                toast('Conta criada com sucesso!');
                setTimeout(() => location.href = 'perfil.html', 700);
            } catch (err) {
                toast(err.message || 'Erro ao realizar cadastro.');
            }
        });
    }

    const login = $('#loginForm');
    if (login) {
        login.addEventListener('submit', async e => {
            e.preventDefault();
            const f = new FormData(login);
            const email = String(f.get('email')).trim().toLowerCase();
            const senha = String(f.get('senha'));

            try {
               
                const response = await apiFetch('/login', {
                    method: 'POST',
                    body: JSON.stringify({ email, senha })
                });

                localStorage.setItem('letleo_session', JSON.stringify({
                    token: response.token,
                    cliente: response.cliente
                }));

                toast('Bem-vindo de volta!');
                const target = new URLSearchParams(location.search).get('retorno');
                setTimeout(() => location.href = target === 'carrinho.html' ? target : 'perfil.html', 700);
            } catch (err) {
                toast(err.message || 'E-mail ou senha incorretos.');
            }
        });
    }
}

async function initProfile() {
    const f = $('#profileForm');
    if (!f) return;
    const user = currentUser();

    if (!user || !user.token) {
        f.hidden = true;
        $('#profileGuest').hidden = false;
        return;
    }

    try {
   
        const data = await apiFetch('/me');
        
        if (f.elements.nome) f.elements.nome.value = data.nome || '';
        if (f.elements.email) f.elements.email.value = data.email || '';
        if (f.elements.telefone) f.elements.telefone.value = maskPhone(data.telefone || '');

        f.addEventListener('submit', async e => {
            e.preventDefault();
            const nome = f.elements.nome.value.trim();
            const telefone = digits(f.elements.telefone.value);

            try {
             
                const atualizado = await apiFetch('/me', {
                    method: 'PUT',
                    body: JSON.stringify({
                        nome,
                        telefone,
                        endereco: data.endereco || 'Endereço não informado'
                    })
                });

                user.cliente = atualizado;
                localStorage.setItem('letleo_session', JSON.stringify(user));
                toast('Perfil atualizado com sucesso!');
            } catch (err) {
                toast('Erro ao atualizar perfil: ' + err.message);
            }
        });

        $('#logoutButton').addEventListener('click', async () => {
            try {
                await apiFetch('/logout', { method: 'POST' });
            } catch {}
            localStorage.removeItem('letleo_session');
            location.href = 'index.html';
        });
    } catch (err) {
        f.hidden = true;
        $('#profileGuest').hidden = false;
    }
}

function initContact() {
    const f = $('#contactForm');
    if (f) {
        f.addEventListener('submit', e => {
            e.preventDefault();
            toast('Mensagem registrada com sucesso!');
            f.reset();
        });
    }
}

function initShell() {
    const theme = localStorage.getItem('letleo_theme') || 'dark';
    document.documentElement.dataset.theme = theme;
    
    if ($('#themeToggle')) {
        $('#themeToggle').textContent = theme === 'dark' ? '☀' : '☾';
        $('#themeToggle').addEventListener('click', () => {
            const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
            document.documentElement.dataset.theme = next;
            localStorage.setItem('letleo_theme', next);
            $('#themeToggle').textContent = next === 'dark' ? '☀' : '☾';
        });
    }

    if ($('#menuToggle')) {
        $('#menuToggle').addEventListener('click', () => $('#nav').classList.toggle('open'));
    }

    const p = document.body.dataset.page;
    $$('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === p));

    if (currentUser()) {
        const loginLink = $('.auth-link');
        if (loginLink) {
            loginLink.href = 'perfil.html';
            loginLink.textContent = 'Meu perfil';
        }
        const registerLink = $('.register-link');
        if (registerLink) registerLink.style.display = 'none';
    }

    updateCartCount();

    document.addEventListener('click', e => {
        const b = e.target.closest('[data-add]');
        if (b) {
            addToCart({
                id: Number(b.dataset.add),
                nome: b.dataset.nome,
                preco: Number(b.dataset.preco),
                imagem: b.dataset.imagem
            });
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initShell();
    initMasks();
    renderFeatured();
    initCatalog();
    initProduct();
    initCart();
    initOrders();
    initAuth();
    initProfile();
    initContact();
});