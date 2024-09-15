import React, { useState, useEffect } from "react";
import { useRef } from "react";
import {
  FaArrowRight,
  FaGithub,
  FaLinkedin,
  FaInstagram,
  FaPhoneAlt,
} from "react-icons/fa";
import { CiMail } from "react-icons/ci";
import { FiPhone } from "react-icons/fi";
import { IoLocationOutline } from "react-icons/io5";

function Home() {
  //   const [displayedWord, setDisplayedWord] = useState("");
  //   const [isDeleting, setIsDeleting] = useState(false);
  //   const words = [" a twist", " designing mind"];
  // const [wordIndex, setWordIndex] = useState(0);

  // useEffect(() => {
  //   let timer;

  //   const typeEffect = () => {
  //     const currentWord = words[wordIndex];

  //     if (!isDeleting) {
  //       if (displayedWord.length < currentWord.length) {
  //         setDisplayedWord(currentWord.slice(0, displayedWord.length + 1));
  //         timer = setTimeout(typeEffect, 250);
  //       } else {
  //         // Palabra completa, espera 4 segundos antes de borrar
  //         timer = setTimeout(() => setIsDeleting(true), 4000);
  //       }
  //     } else {
  //       if (displayedWord.length > 0) {
  //         setDisplayedWord(currentWord.slice(0, displayedWord.length - 1));
  //         timer = setTimeout(typeEffect, 50);
  //       } else {
  //         // Palabra borrada, cambia a la siguiente palabra
  //         setIsDeleting(false);
  //         setWordIndex((prev) => (prev + 1) % words.length);
  //         timer = setTimeout(typeEffect, 250);
  //       }
  //     }
  // };

  //   timer = setTimeout(typeEffect, 100);

  //   return () => clearTimeout(timer);
  // }, [displayedWord, isDeleting, wordIndex, words]);

  // ======================        Use Effect 1     ====================================

  const titleRef = useRef(null); // Crear referencia para el título
  const [isVisible, setIsVisible] = useState(false); // Estado para visibilidad

  const projectRef = useRef(null);
  const [projectVisible, setProjectVisible] = useState(false); // Estado para visibilidad

  useEffect(() => {
    const handleScroll = () => {
      if (titleRef.current) {
        const rect = titleRef.current.getBoundingClientRect();
        setIsVisible(rect.top < window.innerHeight && rect.bottom > 0); // Verificar si está en vista
      }
      if (projectRef.current) {
        const rect = projectRef.current.getBoundingClientRect();
        setProjectVisible(rect.top < window.innerHeight && rect.bottom > 0); // Verificar si está en vista
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ======================        Use Effect 2     ====================================//

  const StitleRef = useRef(null); // Crear referencia para el título
  const [sisVisible, setSIsVisible] = useState(false); // Estado para visibilidad

  useEffect(() => {
    const handleScroll = () => {
      if (StitleRef.current) {
        const Srect = StitleRef.current.getBoundingClientRect();
        setSIsVisible(Srect.top < window.innerHeight && Srect.bottom > 0); // Verificar si está en vista
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      {/* ==========================================      sectionEmpresa        =================================== */}

      <div className="sectionEmpresa" id="empresa">
        <div className="titleH3 tituloLaEmpresa" ref={projectRef}>
          <h3
            className={`tituloLaEmpresa ${projectVisible ? "slide-left" : ""}`}
          >
            La empresa{" "}
          </h3>
        </div>
        <div className="">
          <p className="m-2">
            Desde 1991 visualizamos a Uruguay y la región como un mercado muy
            promisorio para el desarrollo de la construcción civil, basado en
            sistemas modernos, confiables y duraderos.{" "}
          </p>{" "}
          <p>
            Acompañando su proyecto desde el inicio, hemos creado la más
            eficiente red de distribución y logística de perfiles, sistemas de
            arquitectura de aluminio, cristales y accesorios. Para ello contamos
            con los mejores proveedores a nivel mundial, tanto en las áreas de
            tecnología de producto como en servicios, sumándole un servicio
            técnico y de postventa que garantiza el éxito de su obra.
          </p>
        </div>

        <div className="container3-4">
          <p className="more-projects-link">
            more <FaArrowRight style={{ marginLeft: "8px" }} />
          </p>
        </div>
      </div>

      <div id="obras"></div>

      {/* ======================================     sectionEmpresa />       =================================== */}

      {/* =======================================    < section Obras       =================================== */}

      <div className="sectionObras">
        <div className="titleH3 " ref={titleRef} style={{ textAlign: "right" }}>
          <h3
            className={`tituloLaEmpresa ${
              isVisible ? "slide-left" : ""
            } tituloObrasDestacadas`}
          >
            Obras destacadas{" "}
          </h3>
        </div>
        <div className="gridImagenes">
          <section class="layout">
            <div class="uno">
              <p>Art Carrasco</p>
            </div>
            <div class="dos">
              <p>Sofitel</p>
            </div>
            <div class="tres">
              <p>Rincon del Bosque</p>
            </div>
            <div class="cuatro">
              <p>Rincon del Bosque</p>
            </div>
            <div class="cinco">
              <p>Art Carrasco</p>
            </div>
          </section>
        </div>

        <div className="container3-4">
          <p className="more-projects-link">
            more <FaArrowRight style={{ marginLeft: "8px" }} />
          </p>
        </div>
      </div>

      {/* ============================           section Obras  />     =================================== */}
      {/* ============================          < section Slider      =================================== */}

      <section className="section-slider proveedores">
        <div className="titleH3  " style={{ textAlign: "center" }}>
          {/* <div className="provTech">
            <h3>Proveedores y tecnologias </h3>
          </div> */}
        </div>
        <div className="slider-container">
          <div className="slider-icons">
            {/* Nuevas imágenes para el slider */}
            <div className="slider-icon">
              <img src={"../../../public/iseo.jpg"} alt="Iseo" />
            </div>
            <div className="slider-icon">
              <img src={"../../../public/sapa.jpg"} alt="Sapa" />
            </div>
            <div className="slider-icon">
              <img src={"../../../public/vasa.jpg"} alt="Vasa" />
            </div>
            <div className="slider-icon">
              <img src={"../../../public/technal.jpg"} alt="Technal" />
            </div>
            {/* Duplicamos los iconos para crear un efecto de bucle infinito */}
            <div className="slider-icon">
              <img src={"../../../public/iseo.jpg"} alt="Iseo" />
            </div>
            <div className="slider-icon">
              <img src={"../../../public/sapa.jpg"} alt="Sapa" />
            </div>
            <div className="slider-icon">
              <img src={"../../../public/vasa.jpg"} alt="Vasa" />
            </div>
            <div className="slider-icon">
              <img src={"../../../public/technal.jpg"} alt="Technal" />
            </div>
            <div className="slider-icon">
              <img src={"../../../public/iseo.jpg"} alt="Iseo" />
            </div>
            <div className="slider-icon">
              <img src={"../../../public/sapa.jpg"} alt="Sapa" />
            </div>
            <div className="slider-icon">
              <img src={"../../../public/vasa.jpg"} alt="Vasa" />
            </div>
            <div className="slider-icon">
              <img src={"../../../public/technal.jpg"} alt="Technal" />
            </div>
            <div className="slider-icon">
              <img src={"../../../public/iseo.jpg"} alt="Iseo" />
            </div>
            <div className="slider-icon">
              <img src={"../../../public/sapa.jpg"} alt="Sapa" />
            </div>
            <div className="slider-icon">
              <img src={"../../../public/vasa.jpg"} alt="Vasa" />
            </div>
            <div className="slider-icon">
              <img src={"../../../public/technal.jpg"} alt="Technal" />
            </div>
          </div>
        </div>
        <div id="contacto"></div>
      </section>

      {/* ============================           section Slider />      =================================== */}

      {/* ============================          < section Contacto       =================================== */}

      <section>
        <div className="sectionEmpresa">
          <div className="titleH3 tituloLaEmpresa titContacto" ref={StitleRef}>
            <h3 className={`tituloLaEmpresa ${sisVisible ? "slide-left" : ""}`}>
              Contacto{" "}
            </h3>
          </div>
          <div>
            <p className="loAtenderemos">
              Lo atenderemos en nuestro horario de atención, de lunes a viernes
              10:00 a 13:00 y de 13:30 a 17:00 horas.
            </p>
          </div>
          <div className=" itemsContacto">
            <div className="item">
              <div>
                <FiPhone className="iconSize" />
              </div>
              <div>
                {" "}
                <p>(+598) 2924 8579 / 092 009661</p>
              </div>
            </div>
            <div className="item">
              <div>
                <CiMail className="iconSize" />
              </div>
              <div>
                
                <p>info@alusur.com.uy</p>
              </div>
            </div>
            <div className="item">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}> {/* Centrar contenido */}
                <a
                  href="https://www.google.com/maps/place/ALUSUR/@-34.8907568,-130.0096206,3z/data=!4m10!1m2!2m1!1salusur!3m6!1s0x959f8161e058b1d5:0xb8e24d92c0a13ba9!8m2!3d-34.8907568!4d-56.1814956!15sCgZhbHVzdXKSARJhbHVtaW5pdW1fc3VwcGxpZXLgAQA!16s%2Fg%2F11f658mcq4?entry=ttu&g_ep=EgoyMDI0MDkxMS4wIKXMDSoASAFQAw%3D%3D"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: "none", color: "inherit" }} // Eliminar subrayado y color negro
                >
                  <div>
                    <IoLocationOutline className="iconSize" />
                  </div>
                  <p>Hocquart 1660, Montevideo, Uruguay</p>
                </a>
              </div>
            </div>
          </div>

          <div className="container3-4">
            <p className="more-projects-link">
              more <FaArrowRight style={{ marginLeft: "8px" }} />
            </p>
          </div>
        </div>
      </section>
      {/* ============================           section Contacto       =================================== */}

      <div className="" id="home">
        {/* <section className="section1 containerLarge">
          <div className="h1Title">
            <h1 className="titulo-principal">
              A fullstack developer with{" "}
              <span className="changing-text">{displayedWord}</span>
            </h1>
          </div>

          <div className="section2">
            <div className="container2-1">
              <h5>Let's Talk</h5>
              <p>
                <a
                  className="mail"
                  href="mailto:sebastian.pradomelesi@gmail.com"
                >
                  sebastian.pradomelesi@gmail.com
                </a>
              </p>
            </div>
            <div className="container2-2">
              <p>
                Hello, I'm Sebastian, a fullstack developer focusing in React,
                NodeJs and WordPress. Closely related to designers, I will bring
                your idea into reality.
              </p>
            </div>
          </div>
        </section> */}

        {/* ==========================      PROJECTS         =====================  */}

        {/* <section className="section3 container" id="projects">
          <div className="container3-1">
            <div className="titleH3">
              <h3>Projects</h3>
            </div>
            <div className="container3-3">
              <p>Explore some of my most recent work.</p>
            </div>
          </div>
          <div className="container3-4">
            <p className="more-projects-link">
              more <FaArrowRight style={{ marginLeft: "8px" }} />
            </p>
          </div>
        </section> */}
        <section className="sectionProjects container">
          {/* ================   Proyect 1   ==================== */}

          <div className="column-container-s4">
            {/* <div
              className="singleProyectContainer
"
            >
              <div className="column-content-s4 project-container">
                <a
                  href="https://equalvision.vercel.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    className="imageProject"
                    src={equalvision}
                    alt="equalvision"
                  />
                </a>
              </div>
              <div className="column-footer-s4">
                <div className="projectsFlexItems">
                  <h4>
                    <a
                      href="https://equalvision.vercel.app/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="project-link"
                    >
                      Equalvision e-commerce
                    </a>
                  </h4>
                </div>

                <h5>Web development</h5>

                <p>
                  Practice E-commerce site featuring a public-facing section for
                  buyers built with React-Redux. The backend API is a RESTful
                  service built with Node.js, Express, Supabase and SQL.
                </p>
              </div>
            </div> */}

            {/* ================   Proyect 1   ==================== */}
            {/* ================   Proyect 2   ==================== */}

            {/* <div
              className="singleProyectContainer
"
            >
              <div className="column-content-s4 project-container">
                <a
                  href="http://alusur.com.uy/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img className="imageProject" src={alusur} alt="alsur" />
                </a>
              </div>
              <div className="column-footer-s4">
                <div className="projectsFlexItems">
                  <h4>
                    <a
                      href="https://alusur.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="project-link"
                    >
                      Alusur sa
                    </a>
                  </h4>
                  <h5>Web development</h5>
                </div>
                <p>
                  Company dedicated to the efficient distribution and logistics
                  of aluminum architectural systems, profiles, and glass.This
                  project was developed using Node, JavaScript, and CSS
                </p>
              </div>
            </div> */}

            {/* ================   Proyect 2   ==================== */}
            {/* ================   Proyect 3  ==================== */}

            {/* <div className="singleProyectContainer">
              <div className="column-content-s4 project-container">
                <a
                  href="https://equalvision-admin.vercel.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    className="imageProject"
                    src={dashboard}
                    alt=" dashboard"
                  />
                </a>
              </div>
              <div className="column-footer-s4">
                <div className="projectsFlexItems">
                  <h4>
                    <a
                      href="https://equalvision-admin.vercel.app/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="project-link"
                    >
                      Backend e-commerce
                    </a>
                  </h4>
                  <h5>Web development</h5>
                </div>
                <p>
                  E-commerce dashboard site section for managing the site, built
                  with React-Redux. . The backend API is a RESTful service built
                  with Node.js, Express, Supabase and SQL.
                </p>
              </div>
            </div> */}

            {/* ================   Proyect 3  ==================== */}
            {/* ================   Proyect 4  ==================== */}

            {/* <div
              className="singleProyectContainer
"
            >
              <div className="column-content-s4 project-container">
                <a
                  href="https://fakeflix-ruby.vercel.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img className="imageProject" src={movie} alt=" movie" />
                </a>
              </div>
              <div className="column-footer-s4">
                <div className="projectsFlexItems">
                  <h4>
                    <a
                      href="https://fakeflix-ruby.vercel.app/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="project-link"
                    >
                      Fakeflix
                    </a>
                  </h4>
                </div>
                <h5>Desktop app </h5>

                <p>
                  Fakeflix is a practice project designed to showcase an
                  engaging and user-friendly interface. It highlights the
                  ability to create a seamless browsing experience with
                  efficient data management This project was developed using
                  Node, JavaScript, and CSS, incorporating Express as the
                  framework and Redux for state management.
                </p>
              </div>
            </div> */}
            {/* ================   Proyect 4  ==================== */}
          </div>
        </section>
        {/* ==========================      PROJECTS         =====================  */}
        {/* ==========================      EXPERTISE         =====================  */}

        {/* <section className="section5 containerLarge" id="expertise">
          <div className="titleH3">
            <h3>Expertise</h3>
          </div>
          <div className="ecpertiseFlexContainer">
            <div className="expertiseFlexItems">
              <h4>
                <span className="dot"></span>Fullstack developer
              </h4>
              <p>
                Looking for a developer who can handle it all? I've got you
                covered. From front to back, I'll build a seamless experience
                that aligns with your brand. Let's take your business to the
                next level with a strong, cohesive digital presence
              </p>
            </div>

            <div className="expertiseFlexItems">
              <h4>
                <span className="dot"></span>Web developer
              </h4>
              <p>
                Your website deserves to stand out. I craft responsive,
                user-friendly sites that capture your brand's essence without
                the hassle of complex code. With Webflow at the core, you'll get
                a secure, custom site that's as unique as your business.
              </p>
            </div>

            <div className="expertiseFlexItems">
              <h4>
                <span className="dot"></span>Wordpress / PHP
              </h4>
              <p>
                Need a site that's both powerful and flexible? I create custom
                WordPress and PHP solutions that fit your needs perfectly. No
                bloated code or generic templates—just a sleek, efficient
                website tailored to your goals.
              </p>
            </div>

            <div className="expertiseFlexItems">
              <h4>
                Mate drinker
                <img
                  src={matesito}
                  alt="Mate"
                  style={{
                    width: "28.8px",
                    height: "28.8px",
                    marginLeft: "8px",
                    verticalAlign: "middle",
                  }}
                />
              </h4>
              <p>
                Powered by mate—the South American drink that keeps me awake and
                sharp—I'm always ready to deliver results on time. Consider it
                my antioxidant secret weapon for staying focused and ensuring
                your project is finished right on schedule.
              </p>
            </div>
          </div>
        </section> */}
        {/* <section className="section-slider">
          <div className="slider-container">
            <div className="slider-icons">
              {techIcons.map((tech, index) => (
                <div key={index} className="slider-icon">
                  <tech.icon className="icon" />
                  <span className="icon-name">{tech.name}</span>
                </div>
              ))}
             
              {techIcons.map((tech, index) => (
                <div key={`duplicate-${index}`} className="slider-icon">
                  <tech.icon className="icon" />
                  <span className="icon-name">{tech.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section> */}

        {/*======================================= Slider2 ==============================*/}

        {/* <section className="section-lets-talk container">
          <div className="lets-talk-flexContainer">
            <div className="lets-talk-flexItem">
              <h2>Let's talk!</h2>
              <a
                href="mailto:sebastian.pradomelesi@gmail.com"
                className="email-button"
                onMouseEnter={(e) => (e.target.style.color = "orange")}
                onMouseLeave={(e) => (e.target.style.color = "white")}
              >
                sebastian.pradomelesi@gmail.com
              </a>
            </div>
          </div>
        </section> */}
      </div>

      {/* Nuevo footer */}
      <footer className="footer ">
        <div className="footer-content">
          <p>&copy; 2024 Sebastian Prado. All rights reserved.</p>
          <div className="social-icons">
            <a
              href="https://github.com/SebaPrado"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaGithub />
            </a>
            <a
              href="https://www.linkedin.com/in/sebastian-prado-b05862281/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaLinkedin />
            </a>
            <a
              href="https://www.instagram.com/sebastian_prado31/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaInstagram />
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}

export default Home;
