import React, { useState, useRef, useEffect } from 'react';
import './AddProject.css';
import TopBar from '../../components/TopBar/TopBar';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from "jwt-decode";
import API_BASE_URL from '../../src';
import Select from 'react-select';

// Sample data for random generation
const sampleData = {
  projectName: "School Timetable Project",
  classes: [
    { room: "101", capacity: "40", building: "Main Building" },
    { room: "102", capacity: "35", building: "Main Building" },
    { room: "S101", capacity: "30", building: "Science Wing" },
    { room: "A101", capacity: "40", building: "Arts Block" }
  ],
  faculty: [
    { id: "F001", name: "John Smith", mail: "john.smith@school.edu" },
    { id: "F002", name: "Sarah Johnson", mail: "sarah.johnson@school.edu" },
    { id: "F003", name: "Robert Davis", mail: "robert.davis@school.edu" },
    { id: "F004", name: "Emily Wilson", mail: "emily.wilson@school.edu" }
  ],
  grades: [
    { grade: "9", section: "A", strength: "35", classAssignmentType: "same" },
    { grade: "9", section: "B", strength: "32", classAssignmentType: "same" },
    { grade: "10", section: "A", strength: "38", classAssignmentType: "same" },
    { grade: "10", section: "B", strength: "36", classAssignmentType: "any" }
  ],
  buildings: ["Main Building", "Science Wing", "Arts Block"],
  subjects: [
    {
      code: "MATH101",
      subject: "Mathematics",
      facultyIds: ["F001"],
      gradeSections: [{ grade: "9", section: "A" }, { grade: "9", section: "B" }],
      classesWeek: "5",
      isCombined: false,
      assignedClasses: []
    },
    {
      code: "ENG101",
      subject: "English",
      facultyIds: ["F002"],
      gradeSections: [{ grade: "9", section: "A" }, { grade: "9", section: "B" }],
      classesWeek: "4",
      isCombined: false,
      assignedClasses: []
    },
    {
      code: "SCI101",
      subject: "Science",
      facultyIds: ["F003"],
      gradeSections: [{ grade: "9", section: "A" }, { grade: "9", section: "B" }],
      classesWeek: "4",
      isCombined: false,
      assignedClasses: []
    }
  ],
  timeSlots: [
    { days: ["Monday"], startTime: "08:30", endTime: "09:30", applicableTo: ["9 - A", "9 - B", "10 - A", "10 - B"] },
    { days: ["Monday"], startTime: "09:30", endTime: "10:30", applicableTo: ["9 - A", "9 - B", "10 - A", "10 - B"] },
    { days: ["Monday"], startTime: "10:45", endTime: "11:45", applicableTo: ["9 - A", "9 - B", "10 - A", "10 - B"] },
    { days: ["Tuesday"], startTime: "08:30", endTime: "09:30", applicableTo: ["9 - A", "9 - B", "10 - A", "10 - B"] }
  ]
};

const MultiStepForm = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [showUpload, setShowUpload] = useState(null);
  const [applyToAllGrades, setApplyToAllGrades] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [facultyMode, setFacultyMode] = useState('organization');
  const [warningMessage, setWarningMessage] = useState("");
  const [isTimeSlotsValid, setIsTimeSlotsValid] = useState(true);
  const [isFieldsValid, setIsFieldsValid] = useState(true);
  const [formData, setFormData] = useState({
    projectName: '',
    classes: [{ room: '', capacity: '', building: '' }],
    faculty: [{ id: '', name: '', mail: '' }],
    subjects: [
      {
        code: '',
        subject: '',
        facultyIds: [],
        gradeSections: [],
        classesWeek: '',
        isCombined: false,
        assignedClasses: [],
      },
    ],
    grades: [{ 
      grade: '', 
      section: '', 
      strength: '',
      classAssignmentType: 'same'
    }],
    buildings: [],
    multipleBuildings: false,
    timeSlots: [{ days: [], startTime: '', endTime: '', applicableTo: [] }],
  });
  const [newBuildingInput, setNewBuildingInput] = useState('');
  const fileInputRef = useRef(null);
  const jsonFileInputRef = useRef(null);

  // Custom styles for most multi-select dropdowns with wrapping (200px width)
  const customStylesWideWithWrap = {
    control: (provided) => ({
      ...provided,
      border: '1px solid #ccc',
      borderRadius: '4px',
      padding: '2px',
      minHeight: '38px',
      fontSize: '14px',
      width: '200px',
      flexWrap: 'wrap',
    }),
    menu: (provided) => ({
      ...provided,
      zIndex: 9999, // Increased z-index to ensure dropdown appears on top
      fontSize: '14px',
      width: '200px',
    }),
    option: (provided, state) => ({
      ...provided,
      padding: '8px 12px',
      backgroundColor: state.isSelected ? '#007bff' : state.isFocused ? '#f0f0f0' : null,
      color: state.isSelected ? 'white' : '#333',
    }),
    multiValue: (provided) => ({
      ...provided,
      backgroundColor: '#e0e0e0',
      borderRadius: '2px',
      margin: '2px',
    }),
    multiValueLabel: (provided) => ({
      ...provided,
      color: '#333',
      fontSize: '12px',
      whiteSpace: 'nowrap',
    }),
    multiValueRemove: (provided) => ({
      ...provided,
      ':hover': {
        backgroundColor: '#ff4d4f',
        color: 'white',
      },
    }),
    valueContainer: (provided) => ({
      ...provided,
      flexWrap: 'wrap',
      padding: '2px 4px',
    }),
  };

  // Custom styles for Faculty dropdown with extra wide width (250px) and wrapping
  const customStylesExtraWideWithWrap = {
    control: (provided) => ({
      ...provided,
      border: '1px solid #ccc',
      borderRadius: '4px',
      padding: '2px',
      minHeight: '38px',
      fontSize: '14px',
      width: '250px',
      flexWrap: 'wrap',
    }),
    menu: (provided) => ({
      ...provided,
      zIndex: 9999, // Increased z-index to ensure dropdown appears on top
      fontSize: '14px',
      width: '250px',
    }),
    option: (provided, state) => ({
      ...provided,
      padding: '8px 12px',
      backgroundColor: state.isSelected ? '#007bff' : state.isFocused ? '#f0f0f0' : null,
      color: state.isSelected ? 'white' : '#333',
    }),
    multiValue: (provided) => ({
      ...provided,
      backgroundColor: '#e0e0e0',
      borderRadius: '2px',
      margin: '2px',
    }),
    multiValueLabel: (provided) => ({
      ...provided,
      color: '#333',
      fontSize: '12px',
      whiteSpace: 'nowrap',
    }),
    multiValueRemove: (provided) => ({
      ...provided,
      ':hover': {
        backgroundColor: '#ff4d4f',
        color: 'white',
      },
    }),
    valueContainer: (provided) => ({
      ...provided,
      flexWrap: 'wrap',
      padding: '2px 4px',
    }),
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        if (decoded && decoded.id) {
          setUserId(decoded.id);
          if (decoded.name) setUserName(decoded.name);
        }
      } catch (error) {
        console.error("Error decoding token:", error);
      }
    }
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user && user._id) {
          setUserId(user._id);
          if (user.name) setUserName(user.name);
          if (user.email) setUserEmail(user.email);
        }
      }
    } catch (error) {
      console.error("Error parsing user from localStorage:", error);
    }
  }, []);

  // Effect to validate time slots whenever formData changes
  useEffect(() => {
    if (currentStep === 6) {
      // Basic field validation
      const fieldsValid = formData.timeSlots.every(
        (row) =>
          row.days.length > 0 &&
          row.startTime.trim() !== '' &&
          row.endTime.trim() !== '' &&
          row.applicableTo.length > 0
      );
      setIsFieldsValid(fieldsValid);

      if (fieldsValid) {
        const { isValid, message } = validateTimeSlots();
        setIsTimeSlotsValid(isValid);
        setWarningMessage(isValid ? "" : message);
      } else {
        setIsTimeSlotsValid(true);
        setWarningMessage("Please fill in all fields for each time slot.");
      }
    } else {
      setWarningMessage("");
      setIsFieldsValid(true);
      setIsTimeSlotsValid(true);
    }
  }, [formData.timeSlots, formData.subjects, formData.grades, currentStep]);

  const generateTimetable = async () => {
    if (!isFieldsValid || !isTimeSlotsValid) {
      const { isValid, message } = validateTimeSlots();
      setWarningMessage(isFieldsValid && !isValid ? message : "Please fill in all fields for each time slot.");
      return;
    }

    try {
      setIsGenerating(true);
      const transformedTimeSlots = formData.timeSlots.flatMap(slot => 
        slot.days.map(day => ({
          day,
          startTime: slot.startTime,
          endTime: slot.endTime,
          applicableTo: slot.applicableTo
        }))
      );
      const requestData = {
        ...formData,
        timeSlots: transformedTimeSlots,
        userId: userId,
        type: facultyMode
      };
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/all/generate-direct`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify(requestData)
      });
      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.message || 'Failed to generate timetable');
      }
      if (responseData.success && responseData.data && responseData.data.timetableId) {
        navigate(`/timetable/${responseData.data.timetableId}`);
      } else {
        throw new Error(responseData.message || 'Invalid response data');
      }
    } catch (error) {
      console.error('Error generating timetable:', error);
      alert(`Failed to generate timetable: ${error.message || 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleJSONUpload = (event) => {
    const file = event.target.files[0];
    if (!file || !file.name.endsWith('.json')) {
      alert('Please upload a JSON file');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = e.target.result;
        const parsedData = JSON.parse(json);
        if (
          parsedData.projectName &&
          Array.isArray(parsedData.classes) &&
          Array.isArray(parsedData.faculty) &&
          Array.isArray(parsedData.grades) &&
          Array.isArray(parsedData.subjects) &&
          Array.isArray(parsedData.timeSlots)
        ) {
          setFormData({
            ...parsedData,
            buildings: parsedData.buildings || [],
            multipleBuildings: parsedData.multipleBuildings || false
          });
          if (parsedData.type) {
            setFacultyMode(parsedData.type);
          }
          alert('JSON data loaded successfully!');
        } else {
          alert('Invalid JSON format. Please check the structure of your data.');
        }
      } catch (error) {
        console.error('Error parsing JSON:', error);
        alert('Failed to parse JSON data. Please check the format.');
      }
    };
    reader.onerror = (error) => {
      console.error('Error reading file:', error);
      alert('Error reading JSON file');
    };
    reader.readAsText(file);
  };

  const goToNextStep = () => {
    if (currentStep < 7 && !showUpload && isStepValid()) {
      setCurrentStep(currentStep + 1);
    } else if (showUpload) {
      setShowUpload(null);
      if (currentStep < 7) setCurrentStep(currentStep + 1);
    }
  };

  const goToPreviousStep = () => {
    if (currentStep === 1) {
      navigate('/dashboard');
    } else if (currentStep > 1) {
      if (showUpload) {
        setShowUpload(null);
      } else {
        setCurrentStep(currentStep - 1);
      }
    }
  };

  const loadRandomData = () => {
    setFormData({
      ...formData,
      projectName: sampleData.projectName,
      classes: [...sampleData.classes],
      faculty: facultyMode === 'personal' 
        ? sampleData.faculty.map(({id, name}) => ({id, name, mail: ''}))
        : [...sampleData.faculty],
      subjects: [...sampleData.subjects],
      grades: [...sampleData.grades],
      timeSlots: [...sampleData.timeSlots],
      buildings: [...sampleData.buildings],
      multipleBuildings: true
    });
  };

  const handleUploadClick = (step) => {
    setShowUpload(step);
    setTimeout(() => {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
        fileInputRef.current.click();
      }
    }, 100);
  };

  const handleJSONUploadClick = () => {
    if (jsonFileInputRef.current) {
      jsonFileInputRef.current.value = '';
      jsonFileInputRef.current.click();
    }
  };

  const handleInputChange = (step, index, field, value) => {
    setFormData(prevData => {
      const updatedData = { ...prevData };
      const updatedStepData = [...updatedData[step]];
      updatedStepData[index] = { ...updatedStepData[index], [field]: value };
      updatedData[step] = updatedStepData;
      console.log(`Updated ${step}[${index}].${field}:`, value);
      return updatedData;
    });
  };

  const handleMultipleBuildingsChange = (e) => {
    const updatedData = { ...formData, multipleBuildings: e.target.checked };
    if (!e.target.checked) {
      updatedData.classes = updatedData.classes.map((row) => ({ ...row, building: '' }));
    }
    setFormData(updatedData);
  };

  const handleApplyToAllGradesChange = (e) => {
    const isChecked = e.target.checked;
    setApplyToAllGrades(isChecked);
    if (isChecked && formData.grades.length > 0) {
      const firstGrade = formData.grades[0];
      const updatedGrades = formData.grades.map(grade => ({
        ...grade,
        classAssignmentType: firstGrade.classAssignmentType
      }));
      setFormData({ ...formData, grades: updatedGrades });
    }
  };

  const addNewBuilding = (index) => {
    if (newBuildingInput && newBuildingInput.trim() !== '') {
      const trimmedBuilding = newBuildingInput.trim();
      setFormData((prevData) => {
        const updatedClasses = [...prevData.classes];
        updatedClasses[index].building = trimmedBuilding;
        return {
          ...prevData,
          buildings: [...prevData.buildings, trimmedBuilding],
          classes: updatedClasses,
        };
      });
      setNewBuildingInput('');
    }
  };

  const handleSubjectCodeChange = (index, value) => {
    if (value === '+Add New Subject Code') {
      const newCode = prompt('Enter new subject code:');
      if (newCode && newCode.trim() !== '') {
        const trimmedCode = newCode.trim();
        setFormData((prevData) => {
          const updatedSubjects = [...prevData.subjects];
          updatedSubjects[index].code = trimmedCode;
          return { ...prevData, subjects: updatedSubjects };
        });
      }
    } else {
      handleInputChange('subjects', index, 'code', value);
    }
  };

  const handleSubjectChange = (index, value) => {
    if (value === '+Add New Subject') {
      const newSubject = prompt('Enter new subject:');
      if (newSubject && newSubject.trim() !== '') {
        const trimmedSubject = newSubject.trim();
        setFormData((prevData) => {
          const updatedSubjects = [...prevData.subjects];
          updatedSubjects[index].subject = trimmedSubject;
          return { ...prevData, subjects: updatedSubjects };
        });
      }
    } else {
      handleInputChange('subjects', index, 'subject', value);
    }
  };

  const handleBuildingChange = (index, value) => {
    if (value === '+Add New Building') {
      // No action needed here as it's handled in addNewBuilding
    } else {
      const updatedData = { ...formData };
      updatedData.classes[index].building = value;
      setFormData(updatedData);
    }
  };

  const handleGradeSectionChange = (index, selectedOptions) => {
    const selectedValues = selectedOptions ? selectedOptions.map(option => option.value) : [];
    setFormData(prevData => {
      const updatedSubjects = [...prevData.subjects];
      updatedSubjects[index] = {
        ...updatedSubjects[index],
        gradeSections: selectedValues.map(value => {
          const [grade, section] = value.split(' - ');
          return { grade, section };
        })
      };
      console.log(`Row ${index} - Updated gradeSections:`, updatedSubjects[index].gradeSections);
      return { ...prevData, subjects: updatedSubjects };
    });
  };

  const handleFacultyModeChange = (mode) => {
    setFacultyMode(mode);
    if (mode === 'personal') {
      setFormData(prevData => ({
        ...prevData,
        faculty: prevData.faculty.map(faculty => ({ ...faculty, mail: '' }))
      }));
    }
  };

  const addNewRow = (step) => {
    const updatedData = { ...formData };
    const lastRow = updatedData[step][updatedData[step].length - 1];
    let isPreviousFilled = true;

    if (step === 'classes') {
      isPreviousFilled =
        lastRow.room.trim() !== '' &&
        lastRow.capacity.trim() !== '' &&
        (!formData.multipleBuildings || lastRow.building.trim() !== '');
    } else if (step === 'faculty') {
      isPreviousFilled =
        lastRow.id.trim() !== '' &&
        lastRow.name.trim() !== '' &&
        (facultyMode === 'personal' || lastRow.mail.trim() !== '');
    } else if (step === 'subjects') {
      isPreviousFilled =
        lastRow.code.trim() !== '' &&
        lastRow.subject.trim() !== '' &&
        lastRow.facultyIds.length > 0 &&
        lastRow.gradeSections.length > 0 &&
        lastRow.classesWeek.trim() !== '';
    } else if (step === 'grades') {
      isPreviousFilled =
        lastRow.grade.trim() !== '' &&
        lastRow.section.trim() !== '' &&
        lastRow.strength.trim() !== '';
    } else if (step === 'timeSlots') {
      isPreviousFilled =
        lastRow.days.length > 0 &&
        lastRow.startTime.trim() !== '' &&
        lastRow.endTime.trim() !== '' &&
        lastRow.applicableTo.length > 0;
    }

    if (isPreviousFilled) {
      updatedData[step].push(
        step === 'classes'
          ? { room: '', capacity: '', building: '' }
          : step === 'faculty'
          ? { id: '', name: '', mail: '' }
          : step === 'subjects'
          ? {
              code: '',
              subject: '',
              facultyIds: [],
              gradeSections: [],
              classesWeek: '',
              isCombined: false,
              assignedClasses: [],
            }
          : step === 'grades'
          ? { 
              grade: '', 
              section: '', 
              strength: '',
              classAssignmentType: applyToAllGrades && updatedData.grades.length > 0 
                ? updatedData.grades[0].classAssignmentType 
                : 'same'
            }
          : { days: [], startTime: '', endTime: '', applicableTo: [] }
      );
      setFormData(updatedData);
    }
  };

  const deleteRow = (step, index) => {
    const updatedData = { ...formData };
    updatedData[step].splice(index, 1);
    setFormData(updatedData);
  };

  // Validate time slots sufficiency
  const validateTimeSlots = () => {
    const requiredSlots = {};
    formData.grades.forEach(grade => {
      const gradeSection = `${grade.grade} - ${grade.section}`;
      requiredSlots[gradeSection] = 0;
    });

    formData.subjects.forEach((subject, index) => {
      const classesPerWeek = parseInt(subject.classesWeek, 10) || 0;
      if (classesPerWeek > 0 && subject.gradeSections.length > 0) {
        subject.gradeSections.forEach(gs => {
          const gradeSection = `${gs.grade} - ${gs.section}`;
          if (requiredSlots.hasOwnProperty(gradeSection)) {
            requiredSlots[gradeSection] += classesPerWeek;
          } else {
            console.warn(`Grade-section ${gradeSection} not found in grades list for subject ${index}`);
          }
        });
      }
    });

    console.log("Required slots per grade-section:", requiredSlots);

    const availableSlots = {};
    formData.grades.forEach(grade => {
      const gradeSection = `${grade.grade} - ${grade.section}`;
      availableSlots[gradeSection] = 0;
    });

    formData.timeSlots.forEach((slot, index) => {
      if (slot.days.length > 0 && slot.applicableTo.length > 0) {
        const slotCount = slot.days.length;
        slot.applicableTo.forEach(gradeSection => {
          if (availableSlots.hasOwnProperty(gradeSection)) {
            availableSlots[gradeSection] += slotCount;
          } else {
            console.warn(`Grade-section ${gradeSection} in time slot ${index} not found in grades list`);
          }
        });
      }
    });

    console.log("Available slots per grade-section:", availableSlots);

    const insufficientSlots = [];
    for (const gradeSection in requiredSlots) {
      const required = requiredSlots[gradeSection];
      const available = availableSlots[gradeSection] || 0;
      if (required > 0 && available < required) {
        insufficientSlots.push(
          `${gradeSection}: Requires ${required} slots, but only ${available} are available.`
        );
      }
    }

    console.log("Insufficient slots:", insufficientSlots);

    if (insufficientSlots.length > 0) {
      return {
        isValid: false,
        message: `Insufficient time slots for the following grade-sections:\n${insufficientSlots.join('\n')}\nPlease add more time slots to proceed.`
      };
    }

    return { isValid: true, message: "" };
  };

  const isStepValid = () => {
    const data = formData[currentStep === 1 ? 'projectName' : currentStep === 2 ? 'classes' : currentStep === 3 ? 'faculty' : currentStep === 4 ? 'grades' : currentStep === 5 ? 'subjects' : 'timeSlots'];
    if (currentStep === 1) return formData.projectName.trim() !== '';
    if (currentStep === 2)
      return formData.classes.every(
        (row) =>
          row.room.trim() !== '' &&
          row.capacity.trim() !== '' &&
          (!formData.multipleBuildings || row.building.trim() !== '')
      );
    if (currentStep === 3)
      return formData.faculty.every(
        (row) => 
          row.id.trim() !== '' && 
          row.name.trim() !== '' && 
          (facultyMode === 'personal' || row.mail.trim() !== '')
      );
    if (currentStep === 4)
      return formData.grades.every(
        (row) => row.grade.trim() !== '' && row.section.trim() !== '' && row.strength.trim() !== ''
      );
    if (currentStep === 5)
      return formData.subjects.every(
        (row) =>
          row.code.trim() !== '' &&
          row.subject.trim() !== '' &&
          row.facultyIds.length > 0 &&
          row.gradeSections.length > 0 &&
          row.classesWeek.trim() !== ''
      );
    if (currentStep === 6) {
      return isFieldsValid && isTimeSlotsValid;
    }
    return true;
  };

  const renderStep = () => {
    if (showUpload) {
      return (
        <div className="step-content">
          <h2>Upload CSV</h2>
          <input
            type="file"
            ref={fileInputRef}
            className="input-hidden"
            accept=".csv"
            onChange={(e) => {
              console.log('CSV upload not implemented');
              e.target.value = '';
            }}
          />
          <div className="button-group">
            <button className="action-button action-button-upload" onClick={() => fileInputRef.current?.click()}>
              Select Files
            </button>
            <button className="action-button action-button-download">Download Sample CSV</button>
          </div>
          <div className="button-container-right">
            <button className="action-button action-button-next" onClick={goToNextStep}>
              Next
            </button>
          </div>
        </div>
      );
    }

    switch (currentStep) {
      case 1:
        return (
          <div className="step-content">
            <h2>Project Name</h2>
            <input
              type="text"
              placeholder="Enter Project Name"
              value={formData.projectName}
              onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
              className="form-input"
            />
            <div className="button-group">
              <button 
                onClick={loadRandomData}
                className="action-button action-button-random"
              >
                Load Random Data
              </button>
              <button 
                onClick={handleJSONUploadClick}
                className="action-button action-button-json"
              >
                Upload JSON File
              </button>
              <input
                type="file"
                ref={jsonFileInputRef}
                className="input-hidden"
                accept=".json"
                onChange={(e) => {
                  handleJSONUpload(e);
                  e.target.value = '';
                }}
              />
            </div>
            <div className="button-container-right">
              <button className="action-button action-button-next" onClick={goToNextStep} disabled={!isStepValid()}>
                Next
              </button>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="step-content">
            <h2>Classes</h2>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.multipleBuildings}
                onChange={handleMultipleBuildingsChange}
                className="form-checkbox"
              />
              <span>Multiple Buildings</span>
            </label>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>Room Capacity</th>
                    {formData.multipleBuildings && <th>Building Name</th>}
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.classes.map((row, index) => (
                    <tr key={index}>
                      <td>
                        <input
                          type="text"
                          value={row.room}
                          onChange={(e) => handleInputChange('classes', index, 'room', e.target.value)}
                          className="form-input"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={row.capacity}
                          onChange={(e) => handleInputChange('classes', index, 'capacity', e.target.value)}
                          className="form-input"
                        />
                      </td>
                      {formData.multipleBuildings && (
                        <td>
                          <select
                            value={row.building}
                            onChange={(e) => handleBuildingChange(index, e.target.value)}
                            className="form-select"
                            style={{ width: '250px' }}
                          >
                            <option value="">Select Building</option>
                            {formData.buildings.map((building, i) => (
                              <option key={i} value={building}>
                                {building}
                              </option>
                            ))}
                            <option value="+Add New Building">+Add New Building</option>
                          </select>
                          {row.building === '+Add New Building' && (
                            <div className="new-building-input">
                              <input
                                type="text"
                                value={newBuildingInput}
                                onChange={(e) => setNewBuildingInput(e.target.value)}
                                placeholder="Enter new building"
                                className="form-input"
                              />
                              <button onClick={() => addNewBuilding(index)} className="action-button action-button-add">
                                Add
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                      <td>
                        {formData.classes.length > 1 && (
                          <button className="action-button action-button-delete" onClick={() => deleteRow('classes', index)}>
                            X
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              className="action-button action-button-add"
              onClick={() => addNewRow('classes')}
              disabled={
                formData.classes.length === 0 ||
                !(
                  formData.classes[formData.classes.length - 1].room.trim() !== '' &&
                  formData.classes[formData.classes.length - 1].capacity.trim() !== '' &&
                  (!formData.multipleBuildings ||
                    formData.classes[formData.classes.length - 1].building.trim() !== '')
                )
              }
            >
              Add New Room
            </button>
            <div className="button-container-right">
              <button className="action-button action-button-next" onClick={goToNextStep} disabled={!isStepValid()}>
                Next
              </button>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="step-content">
            <h2>Faculty</h2>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  name="facultyMode"
                  value="organization"
                  checked={facultyMode === 'organization'}
                  onChange={() => handleFacultyModeChange('organization')}
                  className="form-radio"
                />
                <span>Organization Mode</span>
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="facultyMode"
                  value="personal"
                  checked={facultyMode === 'personal'}
                  onChange={() => handleFacultyModeChange('personal')}
                  className="form-radio"
                />
                <span>Personal Mode</span>
              </label>
            </div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Faculty_Id</th>
                    <th>Name</th>
                    {facultyMode === 'organization' && <th>Mail Id</th>}
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.faculty.map((row, index) => (
                    <tr key={index}>
                      <td>
                        <input
                          type="text"
                          value={row.id}
                          onChange={(e) => handleInputChange('faculty', index, 'id', e.target.value)}
                          className="form-input"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={row.name}
                          onChange={(e) => handleInputChange('faculty', index, 'name', e.target.value)}
                          className="form-input"
                        />
                      </td>
                      {facultyMode === 'organization' && (
                        <td>
                          <input
                            type="text"
                            value={row.mail}
                            onChange={(e) => handleInputChange('faculty', index, 'mail', e.target.value)}
                            className="form-input"
                          />
                        </td>
                      )}
                      <td>
                        {formData.faculty.length > 1 && (
                          <button className="action-button action-button-delete" onClick={() => deleteRow('faculty', index)}>
                            X
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              className="action-button action-button-add"
              onClick={() => addNewRow('faculty')}
              disabled={
                formData.faculty.length === 0 ||
                !(
                  formData.faculty[formData.faculty.length - 1].id.trim() !== '' &&
                  formData.faculty[formData.faculty.length - 1].name.trim() !== '' &&
                  (facultyMode === 'personal' || 
                   formData.faculty[formData.faculty.length - 1].mail.trim() !== '')
                )
              }
            >
              Add New Faculty
            </button>
            <div className="button-container-right">
              <button className="action-button action-button-next" onClick={goToNextStep} disabled={!isStepValid()}>
                Next
              </button>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="step-content">
            <h2>Grades</h2>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={applyToAllGrades}
                onChange={handleApplyToAllGradesChange}
                className="form-checkbox"
              />
              <span>Apply class assignment type to all grades</span>
            </label>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Grade</th>
                    <th>Section</th>
                    <th>Strength</th>
                    <th>Class Assignment Type</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.grades.map((row, index) => (
                    <tr key={index}>
                      <td>
                        <input
                          type="text"
                          value={row.grade}
                          onChange={(e) => handleInputChange('grades', index, 'grade', e.target.value)}
                          className="form-input"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={row.section}
                          onChange={(e) => handleInputChange('grades', index, 'section', e.target.value)}
                          className="form-input"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={row.strength}
                          onChange={(e) => handleInputChange('grades', index, 'strength', e.target.value)}
                          className="form-input"
                        />
                      </td>
                      <td>
                        <select
                          value={row.classAssignmentType}
                          onChange={(e) => {
                            handleInputChange('grades', index, 'classAssignmentType', e.target.value);
                            if (applyToAllGrades) {
                              const updatedGrades = formData.grades.map(grade => ({
                                ...grade,
                                classAssignmentType: e.target.value
                              }));
                              setFormData({ ...formData, grades: updatedGrades });
                            }
                          }}
                          disabled={applyToAllGrades && index !== 0}
                          className="form-select"
                        >
                          <option value="same">Same Class</option>
                          <option value="any">Any Class</option>
                        </select>
                      </td>
                      <td>
                        {formData.grades.length > 1 && (
                          <button className="action-button action-button-delete" onClick={() => deleteRow('grades', index)}>
                            X
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              className="action-button action-button-add"
              onClick={() => addNewRow('grades')}
              disabled={
                formData.grades.length === 0 ||
                !(
                  formData.grades[formData.grades.length - 1].grade.trim() !== '' &&
                  formData.grades[formData.grades.length - 1].section.trim() !== '' &&
                  formData.grades[formData.grades.length - 1].strength.trim() !== ''
                )
              }
            >
              Add New Grade
            </button>
            <div className="button-container-right">
              <button className="action-button action-button-next" onClick={goToNextStep} disabled={!isStepValid()}>
                Next
              </button>
            </div>
          </div>
        );
      case 5:
        return (
          <div className="step-content">
            <h2>Subjects</h2>
            <div className="table-wrapper" style={{ position: 'relative', overflowX: 'auto', overflowY: 'visible' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Subject Code</th>
                    <th>Subject</th>
                    <th>Faculty</th>
                    <th>Grade - Section</th>
                    <th>Combined?</th>
                    <th>Assigned Classes</th>
                    <th>Classes/Week</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.subjects.map((row, index) => {
                    const handleFacultyChange = (selectedOptions) => {
                      const selectedFacultyIds = selectedOptions ? selectedOptions.map(option => option.value) : [];
                      setFormData(prevData => {
                        const updatedSubjects = [...prevData.subjects];
                        updatedSubjects[index] = { ...updatedSubjects[index], facultyIds: selectedFacultyIds };
                        console.log(`Row ${index} - Updated facultyIds:`, selectedFacultyIds);
                        return { ...prevData, subjects: updatedSubjects };
                      });
                    };

                    const handleGradeSectionChangeLocal = (selectedOptions) => {
                      const selectedValues = selectedOptions ? selectedOptions.map(option => option.value) : [];
                      setFormData(prevData => {
                        const updatedSubjects = [...prevData.subjects];
                        updatedSubjects[index] = {
                          ...updatedSubjects[index],
                          gradeSections: selectedValues.map(value => {
                            const [grade, section] = value.split(' - ');
                            return { grade, section };
                          })
                        };
                        console.log(`Row ${index} - Updated gradeSections:`, updatedSubjects[index].gradeSections);
                        return { ...prevData, subjects: updatedSubjects };
                      });
                    };

                    const handleAssignedClassesChange = (selectedOptions) => {
                      const selectedClasses = selectedOptions ? selectedOptions.map(option => option.value) : [];
                      setFormData(prevData => {
                        const updatedSubjects = [...prevData.subjects];
                        updatedSubjects[index] = { ...updatedSubjects[index], assignedClasses: selectedClasses };
                        console.log(`Row ${index} - Updated assignedClasses:`, selectedClasses);
                        return { ...prevData, subjects: updatedSubjects };
                      });
                    };

                    const handleSelectAll = () => {
                      const gradeSections = row.gradeSections.map(gs => `${gs.grade} - ${gs.section}`);
                      const assignedTypeGrades = formData.grades.filter(grade => 
                        gradeSections.includes(`${grade.grade} - ${grade.section}`) && 
                        grade.classAssignmentType === 'assigned'
                      );
                      if (assignedTypeGrades.length > 0) {
                        alert('Cannot use Select All when grades are set to Assigned type');
                        return;
                      }
                      const allClasses = formData.classes.map(cls => cls.room);
                      setFormData(prevData => {
                        const updatedSubjects = [...prevData.subjects];
                        updatedSubjects[index] = { ...updatedSubjects[index], assignedClasses: allClasses };
                        console.log(`Row ${index} - Select All - Updated assignedClasses:`, allClasses);
                        return { ...prevData, subjects: updatedSubjects };
                      });
                    };

                    const handleClearClasses = () => {
                      setFormData(prevData => {
                        const updatedSubjects = [...prevData.subjects];
                        updatedSubjects[index] = { ...updatedSubjects[index], assignedClasses: [] };
                        console.log(`Row ${index} - Clear - Updated assignedClasses:`, []);
                        return { ...prevData, subjects: updatedSubjects };
                      });
                    };

                    const isAssignedType = row.gradeSections.some(gs => 
                      formData.grades.find(g => 
                        g.grade === gs.grade && 
                        g.section === gs.section && 
                        g.classAssignmentType === 'assigned'
                      )
                    );

                    const subjectCodeOptions = [...new Set(formData.subjects.map((s) => s.code).filter(Boolean))];
                    const subjectOptions = [...new Set(formData.subjects.map((s) => s.subject).filter(Boolean))];
                    console.log(`Row ${index} - Subject Code Options:`, ['Test', ...subjectCodeOptions, '+Add New Subject Code']);
                    console.log(`Row ${index} - Subject Options:`, ['Hi', ...subjectOptions, '+Add New Subject']);

                    const facultyOptions = formData.faculty.map(faculty => ({
                      value: faculty.id,
                      label: `${faculty.id} - ${faculty.name}`
                    }));

                    const gradeSectionOptions = formData.grades.map(grade => ({
                      value: `${grade.grade} - ${grade.section}`,
                      label: `${grade.grade} - ${grade.section}`
                    }));

                    const classOptions = formData.classes.map(cls => ({
                      value: cls.room,
                      label: cls.room
                    }));

                    const selectedFaculty = row.facultyIds.map(id => 
                      facultyOptions.find(option => option.value === id)
                    ).filter(Boolean);

                    const selectedGradeSections = row.gradeSections.map(gs => ({
                      value: `${gs.grade} - ${gs.section}`,
                      label: `${gs.grade} - ${gs.section}`
                    }));

                    const selectedClasses = row.assignedClasses.map(room => ({
                      value: room,
                      label: room
                    }));

                    return (
                      <tr key={index}>
                        <td>
                          <select
                            value={row.code}
                            onChange={(e) => handleSubjectCodeChange(index, e.target.value)}
                            className="form-select"
                            style={{ width: '250px' }}
                          >
                            <option value="">Select Subject Code</option>
                            <option value="Test">Test</option>
                            {[...new Set(formData.subjects.map((s) => s.code).filter(Boolean))].map(
                              (code, i) => (
                                <option key={i} value={code}>
                                  {code}
                                </option>
                              )
                            )}
                            <option value="+Add New Subject Code">+Add New Subject Code</option>
                          </select>
                        </td>
                        <td>
                          <select
                            value={row.subject}
                            onChange={(e) => handleSubjectChange(index, e.target.value)}
                            className="form-select"
                            style={{ width: '250px' }}
                          >
                            <option value="">Select Subject</option>
                            <option value="Hi">Hi</option>
                            {[...new Set(formData.subjects.map((s) => s.subject).filter(Boolean))].map(
                              (subject, i) => (
                                <option key={i} value={subject}>
                                  {subject}
                                </option>
                              )
                            )}
                            <option value="+Add New Subject">+Add New Subject</option>
                          </select>
                        </td>
                        <td>
                          <Select
                            isMulti
                            options={facultyOptions}
                            value={selectedFaculty}
                            onChange={handleFacultyChange}
                            styles={customStylesExtraWideWithWrap}
                            placeholder="Select Faculty..."
                          />
                        </td>
                        <td>
                          <Select
                            isMulti
                            options={gradeSectionOptions}
                            value={selectedGradeSections}
                            onChange={handleGradeSectionChangeLocal}
                            styles={customStylesWideWithWrap}
                            placeholder="Select Grades..."
                          />
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={row.isCombined}
                            onChange={(e) =>
                              handleInputChange('subjects', index, 'isCombined', e.target.checked)
                            }
                            className="form-checkbox"
                          />
                        </td>
                        <td>
                          <div className="select-actions">
                            <div className="button-group">
                              <button 
                                onClick={handleSelectAll}
                                disabled={isAssignedType}
                                className="action-button action-button-small"
                              >
                                Select All
                              </button>
                              <button 
                                onClick={handleClearClasses}
                                disabled={isAssignedType}
                                className="action-button action-button-small"
                              >
                                Clear
                              </button>
                            </div>
                            <Select
                              isMulti
                              options={classOptions}
                              value={selectedClasses}
                              onChange={handleAssignedClassesChange}
                              isDisabled={isAssignedType}
                              styles={customStylesWideWithWrap}
                              placeholder="Select Classes..."
                            />
                          </div>
                        </td>
                        <td>
                          <input
                            type="text"
                            value={row.classesWeek}
                            onChange={(e) =>
                              handleInputChange('subjects', index, 'classesWeek', e.target.value)
                            }
                            className="form-input"
                          />
                        </td>
                        <td>
                          {formData.subjects.length > 1 && (
                            <button className="action-button action-button-delete" onClick={() => deleteRow('subjects', index)}>
                              X
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button
              className="action-button action-button-add"
              onClick={() => addNewRow('subjects')}
              disabled={
                formData.subjects.length === 0 ||
                !(
                  formData.subjects[formData.subjects.length - 1].code.trim() !== '' &&
                  formData.subjects[formData.subjects.length - 1].subject.trim() !== '' &&
                  formData.subjects[formData.subjects.length - 1].facultyIds.length > 0 &&
                  formData.subjects[formData.subjects.length - 1].gradeSections.length > 0 &&
                  formData.subjects[formData.subjects.length - 1].classesWeek.trim() !== ''
                )
              }
            >
              Add New Subject
            </button>
            <div className="button-container-right">
              <button className="action-button action-button-next" onClick={goToNextStep} disabled={!isStepValid()}>
                Next
              </button>
            </div>
          </div>
        );
      case 6:
        return (
          <div className="step-content">
            <h2>Time Slots</h2>
            {warningMessage && (
              <div className="warning-message" style={{ color: 'red', whiteSpace: 'pre-line', marginBottom: '10px' }}>
                {warningMessage}
              </div>
            )}
            <div className="table-wrapper" style={{ position: 'relative', overflowX: 'auto', overflowY: 'visible' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Days</th>
                    <th>Start Time</th>
                    <th>End Time</th>
                    <th>Applicable To (Grade - Section)</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.timeSlots.map((row, index) => {
                    const isTimeOverlapping = (start, end, checkIndex) => {
                      return formData.timeSlots.some((slot, i) => {
                        if (i === checkIndex) return false;
                        if (!slot.days.some(day => row.days.includes(day))) return false;
                        const slotStart = slot.startTime;
                        const slotEnd = slot.endTime;
                        return (
                          (start >= slotStart && start < slotEnd) ||
                          (end > slotStart && end <= slotEnd) ||
                          (start <= slotStart && end >= slotEnd)
                        );
                      });
                    };

                    const overlappingSlots = formData.timeSlots.filter(
                      (slot, i) =>
                        i !== index &&
                        slot.days.some(day => row.days.includes(day)) &&
                        isTimeOverlapping(row.startTime, row.endTime, index)
                    );
                    const usedGradeSections = new Set(
                      overlappingSlots.flatMap(slot => slot.applicableTo)
                    );

                    const availableGradeSections = formData.grades.filter(
                      grade => !usedGradeSections.has(`${grade.grade} - ${grade.section}`)
                    );

                    const handleDaysChange = (selectedOptions) => {
                      const selectedDays = selectedOptions ? selectedOptions.map(option => option.value) : [];
                      handleInputChange('timeSlots', index, 'days', selectedDays);
                    };

                    const handleApplicableToChange = (selectedOptions) => {
                      const selectedOptionsValues = selectedOptions ? selectedOptions.map(option => option.value) : [];
                      handleInputChange('timeSlots', index, 'applicableTo', selectedOptionsValues);
                    };

                    const dayOptions = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => ({
                      value: day,
                      label: day
                    }));

                    const applicableToOptions = availableGradeSections.map(grade => ({
                      value: `${grade.grade} - ${grade.section}`,
                      label: `${grade.grade} - ${grade.section}`
                    }));

                    const selectedDays = row.days.map(day => ({
                      value: day,
                      label: day
                    }));

                    const selectedApplicableTo = row.applicableTo.map(value => ({
                      value: value,
                      label: value
                    }));

                    return (
                      <tr key={index}>
                        <td>
                          <Select
                            isMulti
                            options={dayOptions}
                            value={selectedDays}
                            onChange={handleDaysChange}
                            styles={customStylesWideWithWrap}
                            placeholder="Select Days..."
                          />
                        </td>
                        <td>
                          <input
                            type="time"
                            value={row.startTime}
                            onChange={(e) =>
                              handleInputChange('timeSlots', index, 'startTime', e.target.value)
                            }
                            className="form-input"
                          />
                        </td>
                        <td>
                          <input
                            type="time"
                            value={row.endTime}
                            onChange={(e) =>
                              handleInputChange('timeSlots', index, 'endTime', e.target.value)
                            }
                            className="form-input"
                          />
                        </td>
                        <td>
                          <Select
                            isMulti
                            options={applicableToOptions}
                            value={selectedApplicableTo}
                            onChange={handleApplicableToChange}
                            styles={customStylesWideWithWrap}
                            placeholder="Select Grades..."
                            isDisabled={row.days.length === 0 || !row.startTime || !row.endTime}
                          />
                        </td>
                        <td>
                          {formData.timeSlots.length > 1 && (
                            <button className="action-button action-button-delete" onClick={() => deleteRow('timeSlots', index)}>
                              X
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button
              className="action-button action-button-add"
              onClick={() => addNewRow('timeSlots')}
              disabled={
                formData.timeSlots.length === 0 ||
                !(
                  formData.timeSlots[formData.timeSlots.length - 1].days.length > 0 &&
                  formData.timeSlots[formData.timeSlots.length - 1].startTime.trim() !== '' &&
                  formData.timeSlots[formData.timeSlots.length - 1].endTime.trim() !== '' &&
                  formData.timeSlots[formData.timeSlots.length - 1].applicableTo.length > 0
                )
              }
            >
              Add New Time Slot
            </button>
            <div className="button-container-right">
              <button className="action-button action-button-next" onClick={goToNextStep} disabled={!isStepValid()}>
                Next
              </button>
            </div>
          </div>
        );
      case 7:
        return (
          <div className="step-content">
            <h2>Summary</h2>
            {warningMessage && (
              <div className="warning-message" style={{ color: 'red', whiteSpace: 'pre-line', marginBottom: '10px' }}>
                {warningMessage}
              </div>
            )}
            <div className="summary-section">
              <h3>Project Name</h3>
              <p>{formData.projectName}</p>
            </div>
            <div className="summary-section">
              <h3>Classes</h3>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Room</th>
                      <th>Room Capacity</th>
                      {formData.multipleBuildings && <th>Building Name</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {formData.classes.map((row, index) => (
                      <tr key={index}>
                        <td>{row.room}</td>
                        <td>{row.capacity}</td>
                        {formData.multipleBuildings && <td>{row.building}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="summary-section">
              <h3>Faculty</h3>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Faculty_Id</th>
                      <th>Name</th>
                      {facultyMode === 'organization' && <th>Mail Id</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {formData.faculty.map((row, index) => (
                      <tr key={index}>
                        <td>{row.id}</td>
                        <td>{row.name}</td>
                        {facultyMode === 'organization' && <td>{row.mail || 'N/A'}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="summary-section">
              <h3>Grades</h3>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Grade</th>
                      <th>Section</th>
                      <th>Strength</th>
                      <th>Class Assignment Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.grades.map((row, index) => (
                      <tr key={index}>
                        <td>{row.grade}</td>
                        <td>{row.section}</td>
                        <td>{row.strength}</td>
                        <td>{row.classAssignmentType === 'same' ? 'Same Class' : 'Any Class'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="summary-section">
              <h3>Subjects</h3>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Subject Code</th>
                      <th>Subject</th>
                      <th>Faculty</th>
                      <th>Grade - Section</th>
                      <th>Combined?</th>
                      <th>Assigned Classes</th>
                      <th>Classes/Week</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.subjects.map((row, index) => (
                      <tr key={index}>
                        <td>{row.code}</td>
                        <td>{row.subject}</td>
                        <td>{row.facultyIds.join(', ')}</td>
                        <td>{row.gradeSections.map((gs) => `${gs.grade} - ${gs.section}`).join(', ')}</td>
                        <td>{row.isCombined ? 'Yes' : 'No'}</td>
                        <td>{row.assignedClasses.length > 0 ? row.assignedClasses.join(', ') : 'None'}</td>
                        <td>{row.classesWeek}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="summary-section">
              <h3>Time Slots</h3>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Days</th>
                      <th>Start Time</th>
                      <th>End Time</th>
                      <th>Applicable To (Grade - Section)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.timeSlots.map((row, index) => (
                      <tr key={index}>
                        <td>{row.days.join(', ')}</td>
                        <td>{row.startTime}</td>
                        <td>{row.endTime}</td>
                        <td>{row.applicableTo.join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="summary-section user-info-section">
              <h3>User Information</h3>
              <table className="user-info-table">
                <tbody>
                  <tr>
                    <td><strong>User ID:</strong></td>
                    <td>{userId || "Not logged in"}</td>
                  </tr>
                  {userName && (
                    <tr>
                      <td><strong>Name:</strong></td>
                      <td>{userName}</td>
                    </tr>
                  )}
                  {userEmail && (
                    <tr>
                      <td><strong>Email:</strong></td>
                      <td>{userEmail}</td>
                    </tr>
                  )}
                </tbody>
              </table>
              <p className="info-text">
                This timetable will be associated with your account.
              </p>
            </div>
            <div className="button-group">
              <button className="action-button action-button-back" onClick={goToPreviousStep}>
                Back
              </button>
              <button 
                className="action-button action-button-generate"
                onClick={generateTimetable}
                disabled={isGenerating}
              >
                {isGenerating ? 'Generating...' : 'Generate Timetable Directly'}
              </button>
              <button 
                onClick={() => {
                  const jsonData = JSON.stringify(formData, null, 2);
                  const blob = new Blob([jsonData], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${formData.projectName.replace(/\s+/g, '_')}_timetable_data.json`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                className="action-button action-button-export"
              >
                Export Data as JSON
              </button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="page-wrapper">
      <TopBar />
      <div className="form-container">
        <div className="progress-tracker">
          <span className="back-arrow" onClick={goToPreviousStep}>
            ←
          </span>
          <div className="steps-container">
            {[1, 2, 3, 4, 5, 6, 7].map((step) => (
              <span
                key={step}
                className={`step-indicator ${currentStep >= step ? 'active' : ''}`}
              >
                {step}
              </span>
            ))}
          </div>
        </div>
        <div className="form-content">{renderStep()}</div>
      </div>
    </div>
  );
};

export default MultiStepForm;